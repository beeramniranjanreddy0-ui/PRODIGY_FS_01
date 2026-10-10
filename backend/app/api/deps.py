from typing import Generator

from fastapi import Depends
from sqlalchemy.orm import Session

from app.services.auth import get_current_user, get_db


def get_db_session() -> Generator[Session, None, None]:
    yield from get_db()


def get_authenticated_user(user=Depends(get_current_user)):
    return user
