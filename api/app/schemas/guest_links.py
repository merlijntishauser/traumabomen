import uuid
from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, Field, StringConstraints

from app.models.guest_link import EXPIRY_DAY_CHOICES, MAX_OWNER_BLOB_CHARS

# link_id is 16 bytes and token 32 bytes as unpadded base64url.
LinkId = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9_-]{22}$")]
Token = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9_-]{43}$")]


def _check_days(value: int) -> int:
    if value not in EXPIRY_DAY_CHOICES:
        raise ValueError(f"days must be one of {EXPIRY_DAY_CHOICES}")
    return value


Days = Annotated[int, AfterValidator(_check_days)]
# No max_length here: an oversized copy is a 413, not a 422, and is checked by the route.
Ciphertext = Annotated[str, StringConstraints(min_length=1)]
OwnerBlob = Annotated[str, Field(max_length=MAX_OWNER_BLOB_CHARS)]


class CreateGuestLinkRequest(BaseModel):
    link_id: LinkId
    token: Token
    ciphertext: Ciphertext
    owner_blob: OwnerBlob
    expires_in_days: Days


class RepublishRequest(BaseModel):
    ciphertext: Ciphertext


class ExpiryRequest(BaseModel):
    days: Days


class GuestOpenRequest(BaseModel):
    link_id: LinkId
    token: Token


class GuestOpenResponse(BaseModel):
    ciphertext: str


class GuestLinkOut(BaseModel):
    id: uuid.UUID
    owner_blob: str
    created_at: datetime
    published_at: datetime
    expires_at: datetime
    open_count: int
    last_opened_at: datetime | None
    network_count: int | None
    failed_total: int
    locked: bool
