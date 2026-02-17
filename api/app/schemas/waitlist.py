from datetime import datetime

from pydantic import BaseModel, EmailStr


class WaitlistJoinRequest(BaseModel):
    email: EmailStr


class WaitlistEntryResponse(BaseModel):
    id: str
    email: str
    status: str
    created_at: datetime
    approved_at: datetime | None


class WaitlistListResponse(BaseModel):
    items: list[WaitlistEntryResponse]
    waiting: int
    approved: int
    registered: int
