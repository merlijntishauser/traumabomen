import uuid
from typing import Literal

from pydantic import BaseModel, Field

AudienceType = Literal["disabled", "admins", "selected", "all"]


class AdminFeatureFlag(BaseModel):
    key: str
    audience: AudienceType
    selected_user_ids: list[str]


class AdminFeaturesResponse(BaseModel):
    flags: list[AdminFeatureFlag]


class UpdateFeatureFlagRequest(BaseModel):
    audience: AudienceType
    user_ids: list[uuid.UUID] = Field(default=[], max_length=10000)
