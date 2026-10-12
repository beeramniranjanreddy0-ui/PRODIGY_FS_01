from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserBase(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=150)
    email: EmailStr

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, value: str) -> str:
        return " ".join(value.strip().split())


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)
    password_confirm: str = Field(..., min_length=8)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        if not any(ch.isupper() for ch in value):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not any(ch.isdigit() for ch in value):
            raise ValueError("Password must contain at least one number.")
        return value

    @field_validator("password_confirm")
    @classmethod
    def validate_password_match(cls, value: str, info):
        values = info.data
        password = values.get("password")
        if password and value != password:
            raise ValueError("Passwords do not match.")
        return value


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=150)


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshTokenRequest(BaseModel):
    refresh_token: str | None = Field(default=None, min_length=10)


class AuthResponse(BaseModel):
    user: UserOut
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    tokens: TokenPair | None = None
