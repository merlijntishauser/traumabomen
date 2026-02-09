import uuid

from pydantic import BaseModel

from app.schemas.tree import (
    EventCreate,
    EventUpdate,
    PersonCreate,
    PersonUpdate,
    RelationshipCreate,
    RelationshipUpdate,
)


class SyncDelete(BaseModel):
    id: uuid.UUID


class SyncPersonCreate(PersonCreate):
    id: uuid.UUID | None = None


class SyncRelationshipCreate(RelationshipCreate):
    id: uuid.UUID | None = None


class SyncEventCreate(EventCreate):
    id: uuid.UUID | None = None


class SyncPersonUpdate(PersonUpdate):
    id: uuid.UUID


class SyncRelationshipUpdate(RelationshipUpdate):
    id: uuid.UUID


class SyncEventUpdate(EventUpdate):
    id: uuid.UUID


class SyncRequest(BaseModel):
    persons_create: list[SyncPersonCreate] = []
    persons_update: list[SyncPersonUpdate] = []
    persons_delete: list[SyncDelete] = []
    relationships_create: list[SyncRelationshipCreate] = []
    relationships_update: list[SyncRelationshipUpdate] = []
    relationships_delete: list[SyncDelete] = []
    events_create: list[SyncEventCreate] = []
    events_update: list[SyncEventUpdate] = []
    events_delete: list[SyncDelete] = []


class SyncResponse(BaseModel):
    persons_created: list[uuid.UUID] = []
    relationships_created: list[uuid.UUID] = []
    events_created: list[uuid.UUID] = []
    persons_updated: int = 0
    relationships_updated: int = 0
    events_updated: int = 0
    persons_deleted: int = 0
    relationships_deleted: int = 0
    events_deleted: int = 0
