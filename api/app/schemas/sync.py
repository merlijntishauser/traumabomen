import uuid

from pydantic import BaseModel, Field

from app.schemas.tree import (
    ClassificationCreate,
    ClassificationUpdate,
    EventCreate,
    EventUpdate,
    JournalEntryCreate,
    JournalEntryUpdate,
    LifeEventCreate,
    LifeEventUpdate,
    PatternCreate,
    PatternUpdate,
    PersonCreate,
    PersonUpdate,
    RelationshipCreate,
    RelationshipUpdate,
    SiblingGroupCreate,
    SiblingGroupUpdate,
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


class SyncLifeEventCreate(LifeEventCreate):
    id: uuid.UUID | None = None


class SyncLifeEventUpdate(LifeEventUpdate):
    id: uuid.UUID


class SyncPatternCreate(PatternCreate):
    id: uuid.UUID | None = None


class SyncPatternUpdate(PatternUpdate):
    id: uuid.UUID


class SyncJournalEntryCreate(JournalEntryCreate):
    id: uuid.UUID | None = None


class SyncJournalEntryUpdate(JournalEntryUpdate):
    id: uuid.UUID


class SyncSiblingGroupCreate(SiblingGroupCreate):
    id: uuid.UUID | None = None


class SyncSiblingGroupUpdate(SiblingGroupUpdate):
    id: uuid.UUID


class SyncRequest(BaseModel):
    persons_create: list[SyncPersonCreate] = Field(default=[], max_length=500)
    persons_update: list[SyncPersonUpdate] = Field(default=[], max_length=500)
    persons_delete: list[SyncDelete] = Field(default=[], max_length=500)
    relationships_create: list[SyncRelationshipCreate] = Field(default=[], max_length=500)
    relationships_update: list[SyncRelationshipUpdate] = Field(default=[], max_length=500)
    relationships_delete: list[SyncDelete] = Field(default=[], max_length=500)
    events_create: list[SyncEventCreate] = Field(default=[], max_length=500)
    events_update: list[SyncEventUpdate] = Field(default=[], max_length=500)
    events_delete: list[SyncDelete] = Field(default=[], max_length=500)
    classifications_create: list[SyncClassificationCreate] = Field(default=[], max_length=500)
    classifications_update: list[SyncClassificationUpdate] = Field(default=[], max_length=500)
    classifications_delete: list[SyncDelete] = Field(default=[], max_length=500)
    turning_points_create: list[SyncTurningPointCreate] = Field(default=[], max_length=500)
    turning_points_update: list[SyncTurningPointUpdate] = Field(default=[], max_length=500)
    turning_points_delete: list[SyncDelete] = Field(default=[], max_length=500)
    life_events_create: list[SyncLifeEventCreate] = Field(default=[], max_length=500)
    life_events_update: list[SyncLifeEventUpdate] = Field(default=[], max_length=500)
    life_events_delete: list[SyncDelete] = Field(default=[], max_length=500)
    patterns_create: list[SyncPatternCreate] = Field(default=[], max_length=500)
    patterns_update: list[SyncPatternUpdate] = Field(default=[], max_length=500)
    patterns_delete: list[SyncDelete] = Field(default=[], max_length=500)
    journal_entries_create: list[SyncJournalEntryCreate] = Field(default=[], max_length=500)
    journal_entries_update: list[SyncJournalEntryUpdate] = Field(default=[], max_length=500)
    journal_entries_delete: list[SyncDelete] = Field(default=[], max_length=500)
    sibling_groups_create: list[SyncSiblingGroupCreate] = Field(default=[], max_length=500)
    sibling_groups_update: list[SyncSiblingGroupUpdate] = Field(default=[], max_length=500)
    sibling_groups_delete: list[SyncDelete] = Field(default=[], max_length=500)


class SyncResponse(BaseModel):
    persons_created: list[uuid.UUID] = []
    relationships_created: list[uuid.UUID] = []
    events_created: list[uuid.UUID] = []
    life_events_created: list[uuid.UUID] = []
    classifications_created: list[uuid.UUID] = []
    turning_points_created: list[uuid.UUID] = []
    patterns_created: list[uuid.UUID] = []
    journal_entries_created: list[uuid.UUID] = []
    sibling_groups_created: list[uuid.UUID] = []
    persons_updated: int = 0
    relationships_updated: int = 0
    events_updated: int = 0
    life_events_updated: int = 0
    classifications_updated: int = 0
    turning_points_updated: int = 0
    patterns_updated: int = 0
    journal_entries_updated: int = 0
    sibling_groups_updated: int = 0
    persons_deleted: int = 0
    relationships_deleted: int = 0
    events_deleted: int = 0
    life_events_deleted: int = 0
    classifications_deleted: int = 0
    turning_points_deleted: int = 0
    patterns_deleted: int = 0
    journal_entries_deleted: int = 0
    sibling_groups_deleted: int = 0
