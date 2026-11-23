import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class CreateShareRequest(BaseModel):
    recipient_email: EmailStr
    encrypted_tree_key: str | None = Field(default=None, max_length=2048)
    language: str = Field(default="en", max_length=8)


class CompleteShareRequest(BaseModel):
    encrypted_tree_key: str = Field(max_length=2048)


class ShareResponse(BaseModel):
    id: uuid.UUID
    tree_id: uuid.UUID
    recipient_email: str
    recipient_display_name: str | None
    status: str
    created_at: datetime


class SharedKeyResponse(BaseModel):
    share_id: uuid.UUID
    tree_id: uuid.UUID
    encrypted_tree_key: str
    owner_display_name: str | None
    owner_email: str


class PendingShareResponse(BaseModel):
    share_id: uuid.UUID
    tree_id: uuid.UUID
    recipient_email: str
    recipient_public_key: str
