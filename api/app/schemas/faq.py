import uuid

from pydantic import BaseModel, ConfigDict, Field

QUESTION_MAX = 500
ANSWER_MAX = 5000


class FaqEntry(BaseModel):
    """Public FAQ entry: both languages, the client picks by current locale."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    question_en: str
    answer_en: str
    question_nl: str
    answer_nl: str


class AdminFaqEntry(FaqEntry):
    """FAQ entry with admin-only fields (draft state and ordering)."""

    sort_order: int
    published: bool


class FaqListResponse(BaseModel):
    entries: list[FaqEntry]


class AdminFaqListResponse(BaseModel):
    entries: list[AdminFaqEntry]


class FaqEntryInput(BaseModel):
    """Create/update payload for a FAQ entry."""

    question_en: str = Field(min_length=1, max_length=QUESTION_MAX)
    answer_en: str = Field(min_length=1, max_length=ANSWER_MAX)
    question_nl: str = Field(min_length=1, max_length=QUESTION_MAX)
    answer_nl: str = Field(min_length=1, max_length=ANSWER_MAX)
    sort_order: int = Field(default=0, ge=0)
    published: bool = False
