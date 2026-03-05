from pydantic import BaseModel


class UserFeaturesResponse(BaseModel):
    """Maps feature flag keys to boolean enabled status for the current user."""

    model_config = {"extra": "allow"}


class AdminFeatureFlag(BaseModel):
    key: str
    audience: str
    selected_user_ids: list[str]


class AdminFeaturesResponse(BaseModel):
    flags: list[AdminFeatureFlag]


class UpdateFeatureFlagRequest(BaseModel):
    audience: str
    user_ids: list[str] = []
