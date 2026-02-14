from pydantic import BaseModel


class PeriodCounts(BaseModel):
    day: int
    week: int
    month: int


class OverviewStats(BaseModel):
    total_users: int
    verified_users: int
    signups: PeriodCounts
    active_users: PeriodCounts


class CohortRow(BaseModel):
    week: str
    signup_count: int
    retention: list[float]


class RetentionStats(BaseModel):
    cohorts: list[CohortRow]


class UsageBuckets(BaseModel):
    zero: int = 0
    one_two: int = 0
    three_five: int = 0
    six_ten: int = 0
    eleven_twenty: int = 0
    twenty_plus: int = 0


class UsageStats(BaseModel):
    persons: UsageBuckets
    relationships: UsageBuckets
    events: UsageBuckets


class FunnelStats(BaseModel):
    registered: int
    verified: int
    created_tree: int
    added_person: int
    added_relationship: int
    added_event: int


class ActivityCell(BaseModel):
    day: int
    hour: int
    count: int


class ActivityStats(BaseModel):
    cells: list[ActivityCell]


class GrowthPoint(BaseModel):
    date: str
    total: int


class GrowthStats(BaseModel):
    points: list[GrowthPoint]


class UserRow(BaseModel):
    id: str
    email: str
    created_at: str
    email_verified: bool
    last_login: str | None
    tree_count: int
    person_count: int
    relationship_count: int
    event_count: int


class UserListStats(BaseModel):
    users: list[UserRow]
