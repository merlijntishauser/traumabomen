from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    encryption_salt: str


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    encryption_salt: str


class RegisterResponse(BaseModel):
    message: str


class RefreshRequest(BaseModel):
    refresh_token: str


class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class SaltResponse(BaseModel):
    encryption_salt: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class VerifyResponse(BaseModel):
    message: str
