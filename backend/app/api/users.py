from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_authenticated_user, get_db_session
from app.models.user import User
from app.schemas.user import UserOut, UserUpdate

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def get_current_user_profile(current_user: User = Depends(get_authenticated_user)):
    return current_user


@router.patch("/me", response_model=UserOut)
def update_current_user_profile(payload: UserUpdate, current_user: User = Depends(get_authenticated_user), db: Session = Depends(get_db_session)):
    persistent_user = db.query(User).filter(User.id == current_user.id).first()
    if persistent_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if payload.full_name is not None:
        persistent_user.full_name = payload.full_name.strip()
    db.commit()
    db.refresh(persistent_user)
    return persistent_user
