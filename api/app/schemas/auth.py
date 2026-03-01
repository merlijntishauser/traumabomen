import uuid

from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    encryption_salt: str
    invite_token: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    encryption_salt: str
    onboarding_safety_acknowledged: bool


class RegisterResponse(BaseModel):
    message: str


class RefreshRequest(BaseModel):
    refresh_token: str


class RefreshResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LogoutRequest(BaseModel):
    refresh_token: str


class SaltResponse(BaseModel):
    encryption_salt: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class VerifyResponse(BaseModel):
    message: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class UpdateSaltRequest(BaseModel):
    encryption_salt: str


class DeleteAccountRequest(BaseModel):
    password: str


class KeyRingResponse(BaseModel):
    encrypted_key_ring: str


class KeyRingUpdate(BaseModel):
    encrypted_key_ring: str


class MigrateKeysEntity(BaseModel):
    id: uuid.UUID
    encrypted_data: str


class MigrateKeysTree(BaseModel):
    tree_id: uuid.UUID
    encrypted_data: str
    persons: list[MigrateKeysEntity]
    relationships: list[MigrateKeysEntity]
    events: list[MigrateKeysEntity]
    life_events: list[MigrateKeysEntity]
    turning_points: list[MigrateKeysEntity]
    classifications: list[MigrateKeysEntity]
    patterns: list[MigrateKeysEntity]
    journal_entries: list[MigrateKeysEntity]


class MigrateKeysRequest(BaseModel):
    encrypted_key_ring: str
    trees: list[MigrateKeysTree]
