import uuid

from pydantic import BaseModel, EmailStr, Field

_MAX_MIGRATE_ENTITIES = 5000
_MAX_MIGRATE_TREES = 100


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    encryption_salt: str = Field(max_length=1024)
    invite_token: str | None = Field(default=None, max_length=256)
    language: str = Field(default="en", max_length=8)
    passphrase_hint: str | None = Field(default=None, max_length=255)


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
    passphrase_hint: str | None = None


class ResendVerificationRequest(BaseModel):
    email: EmailStr
    language: str = "en"


class VerifyResponse(BaseModel):
    message: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class UpdateSaltRequest(BaseModel):
    encryption_salt: str = Field(max_length=1024)


class UpdateHintRequest(BaseModel):
    passphrase_hint: str | None = Field(default=None, max_length=255)


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
    persons: list[MigrateKeysEntity] = Field(max_length=_MAX_MIGRATE_ENTITIES)
    relationships: list[MigrateKeysEntity] = Field(max_length=_MAX_MIGRATE_ENTITIES)
    events: list[MigrateKeysEntity] = Field(max_length=_MAX_MIGRATE_ENTITIES)
    life_events: list[MigrateKeysEntity] = Field(max_length=_MAX_MIGRATE_ENTITIES)
    turning_points: list[MigrateKeysEntity] = Field(max_length=_MAX_MIGRATE_ENTITIES)
    classifications: list[MigrateKeysEntity] = Field(max_length=_MAX_MIGRATE_ENTITIES)
    patterns: list[MigrateKeysEntity] = Field(max_length=_MAX_MIGRATE_ENTITIES)
    journal_entries: list[MigrateKeysEntity] = Field(max_length=_MAX_MIGRATE_ENTITIES)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    language: str = "en"


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class MigrateKeysRequest(BaseModel):
    encrypted_key_ring: str
    trees: list[MigrateKeysTree] = Field(max_length=_MAX_MIGRATE_TREES)
