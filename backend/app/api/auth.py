from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.api.deps import get_db_session
from app.models.user import RefreshToken, User
from app.schemas.user import AuthResponse, RefreshTokenRequest, TokenPair, UserCreate, UserLogin, UserOut
from app.services.auth import (
    check_rate_limit,
    decode_token,
    get_current_user,
    get_user_by_email,
    hash_password,
    issue_tokens,
    revoke_refresh_token,
    rotate_refresh_token,
    security,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def serialize_user(user: User) -> UserOut:
    return UserOut.model_validate(user)


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=AuthResponse)
def register_user(payload: UserCreate, db: Session = Depends(get_db_session)):
    if payload.password != payload.password_confirm:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passwords do not match.")
    if len(payload.password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 8 characters long.")
    if not any(ch.isupper() for ch in payload.password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must contain at least one uppercase letter.")
    if not any(ch.isdigit() for ch in payload.password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must contain at least one number.")
    if get_user_by_email(db, payload.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered.")

    user = User(
        full_name=payload.full_name.strip(),
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token, refresh_token = issue_tokens(db, user)
    token_pair = TokenPair(access_token=access_token, refresh_token=refresh_token)
    return AuthResponse(
        user=serialize_user(user),
        access_token=access_token,
        refresh_token=refresh_token,
        tokens=token_pair,
    )


@router.post("/login", response_model=AuthResponse)
def login_user(request: Request, payload: UserLogin, db: Session = Depends(get_db_session)):
    forwarded = request.headers.get("x-forwarded-for") or request.client.host if request.client else "unknown"
    check_rate_limit(f"{payload.email}:{forwarded}")

    user = get_user_by_email(db, payload.email)
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    access_token, refresh_token = issue_tokens(db, user)
    token_pair = TokenPair(access_token=access_token, refresh_token=refresh_token)
    return AuthResponse(
        user=serialize_user(user),
        access_token=access_token,
        refresh_token=refresh_token,
        tokens=token_pair,
    )


@router.post("/refresh", response_model=TokenPair)
def refresh_user_token(payload: RefreshTokenRequest, db: Session = Depends(get_db_session)):
    if not payload.refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token.")

    decode_token(payload.refresh_token, "refresh")
    access_token, new_refresh = rotate_refresh_token(db, payload.refresh_token)
    return TokenPair(access_token=access_token, refresh_token=new_refresh)


@router.post("/logout")
def logout_user(
    payload: RefreshTokenRequest | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    if credentials and credentials.credentials:
        from app.services.auth import blacklist_token

        blacklist_token(db, credentials.credentials, "logout")

    token_value = payload.refresh_token if payload and payload.refresh_token else None
    if token_value:
        revoke_refresh_token(db, token_value, "logout")
    else:
        active_tokens = db.query(RefreshToken).filter(RefreshToken.user_id == current_user.id).all()
        for record in active_tokens:
            record.revoked = True
        db.commit()
    return {"message": "Logged out successfully."}
