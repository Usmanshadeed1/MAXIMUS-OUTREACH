import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator

from app.schemas.auth import AssignedClientInfo


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "manager"
    assigned_client_ids: list[uuid.UUID] = []

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        return v

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name must not be empty.")
        return v.strip()

    @field_validator("role")
    @classmethod
    def role_must_be_manager(cls, v: str) -> str:
        if v != "manager":
            raise ValueError(
                "Cannot create an owner account. role must be 'manager'."
            )
        return v


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    assigned_client_ids: Optional[list[uuid.UUID]] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError("Name must not be empty.")
        return v.strip() if v else v

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        return v


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    role: str
    is_active: bool
    created_at: datetime
    assigned_clients: list[AssignedClientInfo] = []

    model_config = {"from_attributes": True}


class UserList(BaseModel):
    items: list[UserResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
