import uuid
from datetime import datetime

from pydantic import BaseModel, Field

# Maximum size for encrypted_data fields (1 MB).
_MAX_ENCRYPTED_DATA = 1_048_576

# --- Tree ---


class TreeCreate(BaseModel):
    encrypted_data: str = Field(max_length=_MAX_ENCRYPTED_DATA)
    is_demo: bool = False


class TreeUpdate(BaseModel):
    encrypted_data: str = Field(max_length=_MAX_ENCRYPTED_DATA)


class TreeResponse(BaseModel):
    id: uuid.UUID
    encrypted_data: str
    is_demo: bool
    created_at: datetime
    updated_at: datetime


# --- Person ---


class PersonCreate(BaseModel):
    encrypted_data: str = Field(max_length=_MAX_ENCRYPTED_DATA)


class PersonUpdate(BaseModel):
    encrypted_data: str = Field(max_length=_MAX_ENCRYPTED_DATA)


class PersonResponse(BaseModel):
    id: uuid.UUID
    encrypted_data: str
    created_at: datetime
    updated_at: datetime


# --- Relationship ---


class RelationshipCreate(BaseModel):
    source_person_id: uuid.UUID
    target_person_id: uuid.UUID
    encrypted_data: str = Field(max_length=_MAX_ENCRYPTED_DATA)


class RelationshipUpdate(BaseModel):
    source_person_id: uuid.UUID | None = None
    target_person_id: uuid.UUID | None = None
    encrypted_data: str | None = Field(default=None, max_length=_MAX_ENCRYPTED_DATA)


class RelationshipResponse(BaseModel):
    id: uuid.UUID
    source_person_id: uuid.UUID
    target_person_id: uuid.UUID
    encrypted_data: str
    created_at: datetime
    updated_at: datetime


# --- Linked entity base classes ---


class _LinkedEntityCreate(BaseModel):
    person_ids: list[uuid.UUID]
    encrypted_data: str = Field(max_length=_MAX_ENCRYPTED_DATA)


class _LinkedEntityUpdate(BaseModel):
    person_ids: list[uuid.UUID] | None = None
    encrypted_data: str | None = Field(default=None, max_length=_MAX_ENCRYPTED_DATA)


class _LinkedEntityResponse(BaseModel):
    id: uuid.UUID
    person_ids: list[uuid.UUID]
    encrypted_data: str
    created_at: datetime
    updated_at: datetime


# --- TraumaEvent ---


class EventCreate(_LinkedEntityCreate):
    pass


class EventUpdate(_LinkedEntityUpdate):
    pass


class EventResponse(_LinkedEntityResponse):
    pass


# --- LifeEvent ---


class LifeEventCreate(_LinkedEntityCreate):
    pass


class LifeEventUpdate(_LinkedEntityUpdate):
    pass


class LifeEventResponse(_LinkedEntityResponse):
    pass


# --- TurningPoint ---


class TurningPointCreate(_LinkedEntityCreate):
    pass


class TurningPointUpdate(_LinkedEntityUpdate):
    pass


class TurningPointResponse(_LinkedEntityResponse):
    pass


# --- JournalEntry ---


class JournalEntryCreate(BaseModel):
    encrypted_data: str = Field(max_length=_MAX_ENCRYPTED_DATA)


class JournalEntryUpdate(BaseModel):
    encrypted_data: str = Field(max_length=_MAX_ENCRYPTED_DATA)


class JournalEntryResponse(BaseModel):
    id: uuid.UUID
    encrypted_data: str
    created_at: datetime
    updated_at: datetime


# --- Classification ---


class ClassificationCreate(_LinkedEntityCreate):
    pass


class ClassificationUpdate(_LinkedEntityUpdate):
    pass


class ClassificationResponse(_LinkedEntityResponse):
    pass


# --- Pattern ---


class PatternCreate(_LinkedEntityCreate):
    pass


class PatternUpdate(_LinkedEntityUpdate):
    pass


class PatternResponse(_LinkedEntityResponse):
    pass


# --- SiblingGroup ---


class SiblingGroupCreate(_LinkedEntityCreate):
    pass


class SiblingGroupUpdate(_LinkedEntityUpdate):
    pass


class SiblingGroupResponse(_LinkedEntityResponse):
    pass
