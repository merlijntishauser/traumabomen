import uuid
from datetime import datetime

from pydantic import BaseModel


# --- Tree ---


class TreeCreate(BaseModel):
    encrypted_data: str


class TreeUpdate(BaseModel):
    encrypted_data: str


class TreeResponse(BaseModel):
    id: uuid.UUID
    encrypted_data: str
    created_at: datetime
    updated_at: datetime


# --- Person ---


class PersonCreate(BaseModel):
    encrypted_data: str


class PersonUpdate(BaseModel):
    encrypted_data: str


class PersonResponse(BaseModel):
    id: uuid.UUID
    encrypted_data: str
    created_at: datetime
    updated_at: datetime


# --- Relationship ---


class RelationshipCreate(BaseModel):
    source_person_id: uuid.UUID
    target_person_id: uuid.UUID
    encrypted_data: str


class RelationshipUpdate(BaseModel):
    source_person_id: uuid.UUID | None = None
    target_person_id: uuid.UUID | None = None
    encrypted_data: str | None = None


class RelationshipResponse(BaseModel):
    id: uuid.UUID
    source_person_id: uuid.UUID
    target_person_id: uuid.UUID
    encrypted_data: str
    created_at: datetime
    updated_at: datetime


# --- TraumaEvent ---


class EventCreate(BaseModel):
    person_ids: list[uuid.UUID]
    encrypted_data: str


class EventUpdate(BaseModel):
    person_ids: list[uuid.UUID] | None = None
    encrypted_data: str | None = None


class EventResponse(BaseModel):
    id: uuid.UUID
    person_ids: list[uuid.UUID]
    encrypted_data: str
    created_at: datetime
    updated_at: datetime
