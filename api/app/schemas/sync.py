import uuid

from pydantic import BaseModel

from app.schemas.tree import (
    ClassificationCreate,
    ClassificationUpdate,
    EventCreate,
    EventUpdate,
    PatternCreate,
    PatternUpdate,
    PersonCreate,
    PersonUpdate,
    RelationshipCreate,
    RelationshipUpdate,
    TurningPointCreate,
    TurningPointUpdate,
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


class SyncClassificationCreate(ClassificationCreate):
    id: uuid.UUID | None = None


class SyncClassificationUpdate(ClassificationUpdate):
    id: uuid.UUID


class SyncTurningPointCreate(TurningPointCreate):
    id: uuid.UUID | None = None


class SyncTurningPointUpdate(TurningPointUpdate):
    id: uuid.UUID


class SyncPatternCreate(PatternCreate):
    id: uuid.UUID | None = None


class SyncPatternUpdate(PatternUpdate):
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
    classifications_create: list[SyncClassificationCreate] = []
    classifications_update: list[SyncClassificationUpdate] = []
    classifications_delete: list[SyncDelete] = []
    turning_points_create: list[SyncTurningPointCreate] = []
    turning_points_update: list[SyncTurningPointUpdate] = []
    turning_points_delete: list[SyncDelete] = []
    patterns_create: list[SyncPatternCreate] = []
    patterns_update: list[SyncPatternUpdate] = []
    patterns_delete: list[SyncDelete] = []


class SyncResponse(BaseModel):
    persons_created: list[uuid.UUID] = []
    relationships_created: list[uuid.UUID] = []
    events_created: list[uuid.UUID] = []
    classifications_created: list[uuid.UUID] = []
    turning_points_created: list[uuid.UUID] = []
    patterns_created: list[uuid.UUID] = []
    persons_updated: int = 0
    relationships_updated: int = 0
    events_updated: int = 0
    classifications_updated: int = 0
    turning_points_updated: int = 0
    patterns_updated: int = 0
    persons_deleted: int = 0
    relationships_deleted: int = 0
    events_deleted: int = 0
    classifications_deleted: int = 0
    turning_points_deleted: int = 0
    patterns_deleted: int = 0
