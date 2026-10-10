from __future__ import annotations

import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any, DefaultDict

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import settings
from app.db.session import SessionLocal
from app.models.user import RefreshToken, RevokedToken, User

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
security = HTTPBearer(auto_error=False)
LOGIN_ATTEMPTS: DefaultDict[str, list[float]] = {}


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return pwd_context.verify(password, hashed_password)


def create_access_token(subject: str | int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(subject), "exp": int(expire.timestamp()), "type": "access"}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def create_refresh_token(subject: str | int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(subject), "exp": int(expire.timestamp()), "type": "refresh"}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def decode_token(token: str, token_type: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token.") from exc

    if payload.get("type") != token_type:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type.")

    return payload


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email.lower()).first()


def is_token_revoked(db: Session, token: str) -> bool:
    return db.query(RevokedToken).filter(RevokedToken.token == token).first() is not None


def blacklist_token(db: Session, token_value: str, reason: str = "logout") -> None:
    if not token_value or is_token_revoked(db, token_value):
        return
    db.add(RevokedToken(token=token_value, reason=reason))
    db.commit()


def generate_refresh_token_value() -> str:
    return secrets.token_urlsafe(32)


def check_rate_limit(identifier: str) -> None:
    now = time.time()
    bucket = LOGIN_ATTEMPTS.setdefault(identifier, [])
    bucket[:] = [stamp for stamp in bucket if now - stamp < 300]
    if len(bucket) >= 5:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many login attempts. Please try again later.")
    bucket.append(now)


def issue_tokens(db: Session, user: User) -> tuple[str, str]:
    access_token = create_access_token(user.id)
    refresh_token_value = generate_refresh_token_value()
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    existing = db.query(RefreshToken).filter(RefreshToken.user_id == user.id, RefreshToken.revoked.is_(False)).all()
    for token in existing:
        token.revoked = True

    token_record = RefreshToken(token=refresh_token_value, user_id=user.id, expires_at=expires_at)
    db.add(token_record)
    db.commit()
    return access_token, refresh_token_value


def validate_access_token(db: Session, credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    if is_token_revoked(db, credentials.credentials):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token.")

    payload = decode_token(credentials.credentials, "access")
    user_id = int(payload["sub"])
    user = db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token.")
    return user


def revoke_refresh_token(db: Session, token_value: str, reason: str = "logout") -> None:
    if not token_value:
        return
    blacklist_token(db, token_value, reason)
    refresh = db.query(RefreshToken).filter(RefreshToken.token == token_value).first()
    if refresh:
        refresh.revoked = True
    db.commit()


def rotate_refresh_token(db: Session, old_token: str) -> tuple[str, str]:
    refresh = db.query(RefreshToken).filter(RefreshToken.token == old_token, RefreshToken.revoked.is_(False)).first()
    if refresh is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token.")
    if refresh.expires_at <= datetime.now(timezone.utc):
        refresh.revoked = True
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired.")

    new_token = generate_refresh_token_value()
    refresh.revoked = True
    db.add(
        RefreshToken(
            token=new_token,
            user_id=refresh.user_id,
            expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        )
    )
    db.commit()
    return create_access_token(refresh.user_id), new_token


def get_current_user(db: Session = Depends(get_db), credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    return validate_access_token(db, credentials)
