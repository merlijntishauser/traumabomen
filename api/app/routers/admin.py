from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import require_admin
from app.database import get_db
from app.models.event import TraumaEvent
from app.models.login_event import LoginEvent
from app.models.person import Person
from app.models.relationship import Relationship
from app.models.tree import Tree
from app.models.user import User
from app.schemas.admin import (
    ActivityCell,
    ActivityStats,
    CohortRow,
    FunnelStats,
    GrowthPoint,
    GrowthStats,
    OverviewStats,
    PeriodCounts,
    RetentionStats,
    UsageBuckets,
    UsageStats,
    UserListStats,
    UserRow,
)

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


def _period_start(period: str) -> datetime:
    now = datetime.now(UTC)
    if period == "day":
        return now - timedelta(days=1)
    if period == "week":
        return now - timedelta(weeks=1)
    return now - timedelta(days=30)


@router.get("/stats/overview", response_model=OverviewStats)
async def overview_stats(db: AsyncSession = Depends(get_db)) -> OverviewStats:
    total = (await db.execute(select(func.count()).select_from(User))).scalar() or 0
    verified = (
        await db.execute(
            select(func.count()).select_from(User).where(User.email_verified == True)  # noqa: E712
        )
    ).scalar() or 0

    signups: dict[str, int] = {}
    active: dict[str, int] = {}
    for period in ("day", "week", "month"):
        since = _period_start(period)
        signups[period] = (
            await db.execute(select(func.count()).select_from(User).where(User.created_at >= since))
        ).scalar() or 0
        active[period] = (
            await db.execute(
                select(func.count(distinct(LoginEvent.user_id))).where(
                    LoginEvent.logged_at >= since
                )
            )
        ).scalar() or 0

    return OverviewStats(
        total_users=total,
        verified_users=verified,
        signups=PeriodCounts(**signups),
        active_users=PeriodCounts(**active),
    )


def _build_user_active_weeks(users: Sequence[Any], logins: Sequence[Any]) -> dict[str, set[int]]:
    user_signup: dict[str, datetime] = {str(u.id): u.created_at for u in users}
    active_weeks: dict[str, set[int]] = {}
    for login in logins:
        uid = str(login.user_id)
        signup = user_signup.get(uid)
        if signup is None:
            continue
        week_offset = (login.logged_at - signup).days // 7
        active_weeks.setdefault(uid, set()).add(week_offset)
    return active_weeks


def _group_users_into_cohorts(users: Sequence[Any]) -> dict[str, list[str]]:
    cohort_users: dict[str, list[str]] = {}
    for u in users:
        week_start = u.created_at - timedelta(days=u.created_at.weekday())
        week_key = week_start.strftime("%Y-%m-%d")
        cohort_users.setdefault(week_key, []).append(str(u.id))
    return cohort_users


def _compute_cohort_rows(
    cohort_users: dict[str, list[str]],
    active_weeks: dict[str, set[int]],
    weeks: int,
    now: datetime,
) -> list[CohortRow]:
    cohorts: list[CohortRow] = []
    for week_key in sorted(cohort_users.keys()):
        uids = cohort_users[week_key]
        signup_count = len(uids)
        cohort_start = datetime.strptime(week_key, "%Y-%m-%d").replace(tzinfo=UTC)
        max_weeks = min(weeks, (now - cohort_start).days // 7 + 1)
        retention: list[float] = []
        for w in range(max_weeks):
            active_count = sum(1 for uid in uids if w in active_weeks.get(uid, set()))
            pct = round(active_count / signup_count * 100, 1) if signup_count else 0
            retention.append(pct)
        cohorts.append(CohortRow(week=week_key, signup_count=signup_count, retention=retention))
    return cohorts


@router.get("/stats/retention", response_model=RetentionStats)
async def retention_stats(
    db: AsyncSession = Depends(get_db),
    weeks: int = Query(default=12, ge=1, le=52),
) -> RetentionStats:
    now = datetime.now(UTC)
    cutoff = now - timedelta(weeks=weeks)

    result = await db.execute(
        select(User.id, User.created_at).where(User.created_at >= cutoff).order_by(User.created_at)
    )
    users = result.all()

    if not users:
        return RetentionStats(cohorts=[])

    user_ids = [u.id for u in users]
    login_result = await db.execute(
        select(LoginEvent.user_id, LoginEvent.logged_at).where(
            LoginEvent.user_id.in_(user_ids),
            LoginEvent.logged_at >= cutoff,
        )
    )
    logins = login_result.all()

    active_weeks = _build_user_active_weeks(users, logins)
    cohort_users = _group_users_into_cohorts(users)
    cohorts = _compute_cohort_rows(cohort_users, active_weeks, weeks, now)

    return RetentionStats(cohorts=cohorts)


def _bucket(count: int) -> str:
    if count == 0:
        return "zero"
    if count <= 2:
        return "one_two"
    if count <= 5:
        return "three_five"
    if count <= 10:
        return "six_ten"
    if count <= 20:
        return "eleven_twenty"
    return "twenty_plus"


@router.get("/stats/usage", response_model=UsageStats)
async def usage_stats(db: AsyncSession = Depends(get_db)) -> UsageStats:
    # Get all tree IDs
    tree_result = await db.execute(select(Tree.id))
    tree_ids = [row.id for row in tree_result.all()]

    if not tree_ids:
        return UsageStats(
            persons=UsageBuckets(),
            relationships=UsageBuckets(),
            events=UsageBuckets(),
        )

    # Count entities per tree
    async def count_per_tree(model: type) -> dict[str, int]:
        result = await db.execute(
            select(model.tree_id, func.count()).group_by(model.tree_id)  # type: ignore[attr-defined]
        )
        return {str(row[0]): row[1] for row in result.all()}

    person_counts = await count_per_tree(Person)
    rel_counts = await count_per_tree(Relationship)
    event_counts = await count_per_tree(TraumaEvent)

    # Bucket the counts
    def build_buckets(counts: dict[str, int]) -> UsageBuckets:
        buckets = {
            "zero": 0,
            "one_two": 0,
            "three_five": 0,
            "six_ten": 0,
            "eleven_twenty": 0,
            "twenty_plus": 0,
        }
        for tid in tree_ids:
            b = _bucket(counts.get(str(tid), 0))
            buckets[b] += 1
        return UsageBuckets(**buckets)

    return UsageStats(
        persons=build_buckets(person_counts),
        relationships=build_buckets(rel_counts),
        events=build_buckets(event_counts),
    )


@router.get("/stats/funnel", response_model=FunnelStats)
async def funnel_stats(db: AsyncSession = Depends(get_db)) -> FunnelStats:
    registered = (await db.execute(select(func.count()).select_from(User))).scalar() or 0
    verified = (
        await db.execute(
            select(func.count()).select_from(User).where(User.email_verified == True)  # noqa: E712
        )
    ).scalar() or 0

    # Users who own at least one tree
    created_tree = (
        await db.execute(select(func.count(distinct(Tree.user_id))).select_from(Tree))
    ).scalar() or 0

    # Users whose trees have at least one person
    added_person = (
        await db.execute(
            select(func.count(distinct(Tree.user_id)))
            .select_from(Tree)
            .join(Person, Person.tree_id == Tree.id)
        )
    ).scalar() or 0

    # Users whose trees have at least one relationship
    added_relationship = (
        await db.execute(
            select(func.count(distinct(Tree.user_id)))
            .select_from(Tree)
            .join(Relationship, Relationship.tree_id == Tree.id)
        )
    ).scalar() or 0

    # Users whose trees have at least one event
    added_event = (
        await db.execute(
            select(func.count(distinct(Tree.user_id)))
            .select_from(Tree)
            .join(TraumaEvent, TraumaEvent.tree_id == Tree.id)
        )
    ).scalar() or 0

    return FunnelStats(
        registered=registered,
        verified=verified,
        created_tree=created_tree,
        added_person=added_person,
        added_relationship=added_relationship,
        added_event=added_event,
    )


@router.get("/stats/activity", response_model=ActivityStats)
async def activity_stats(db: AsyncSession = Depends(get_db)) -> ActivityStats:
    # Group login events by day-of-week (0=Monday) and hour
    dow = func.extract("isodow", LoginEvent.logged_at) - 1  # isodow: 1=Mon, convert to 0=Mon
    hour = func.extract("hour", LoginEvent.logged_at)

    result = await db.execute(
        select(
            dow.label("day"),
            hour.label("hour"),
            func.count().label("count"),
        )
        .group_by("day", "hour")
        .order_by("day", "hour")
    )

    cells = [
        ActivityCell(day=int(row.day), hour=int(row.hour), count=row.count) for row in result.all()
    ]
    return ActivityStats(cells=cells)


@router.get("/stats/growth", response_model=GrowthStats)
async def growth_stats(db: AsyncSession = Depends(get_db)) -> GrowthStats:
    # Count signups per day
    date_col = func.date_trunc("day", User.created_at).label("signup_date")
    result = await db.execute(
        select(date_col, func.count().label("signup_count")).group_by(date_col).order_by(date_col)
    )
    rows = result.all()

    # Build cumulative running total
    points: list[GrowthPoint] = []
    running_total = 0
    for row in rows:
        running_total += row.signup_count
        points.append(
            GrowthPoint(
                date=row.signup_date.strftime("%Y-%m-%d"),
                total=running_total,
            )
        )

    return GrowthStats(points=points)


@router.get("/stats/users", response_model=UserListStats)
async def user_list_stats(db: AsyncSession = Depends(get_db)) -> UserListStats:
    # Subquery: last login per user
    last_login_sq = (
        select(
            LoginEvent.user_id,
            func.max(LoginEvent.logged_at).label("last_login"),
        )
        .group_by(LoginEvent.user_id)
        .subquery()
    )

    # Subquery: entity counts per user (via trees)
    tree_person_sq = (
        select(Tree.user_id, func.count(Person.id).label("person_count"))
        .outerjoin(Person, Person.tree_id == Tree.id)
        .group_by(Tree.user_id)
        .subquery()
    )
    tree_rel_sq = (
        select(Tree.user_id, func.count(Relationship.id).label("rel_count"))
        .outerjoin(Relationship, Relationship.tree_id == Tree.id)
        .group_by(Tree.user_id)
        .subquery()
    )
    tree_event_sq = (
        select(Tree.user_id, func.count(TraumaEvent.id).label("event_count"))
        .outerjoin(TraumaEvent, TraumaEvent.tree_id == Tree.id)
        .group_by(Tree.user_id)
        .subquery()
    )
    tree_count_sq = (
        select(Tree.user_id, func.count(Tree.id).label("tree_count"))
        .group_by(Tree.user_id)
        .subquery()
    )

    result = await db.execute(
        select(
            User.id,
            User.email,
            User.created_at,
            User.email_verified,
            last_login_sq.c.last_login,
            func.coalesce(tree_count_sq.c.tree_count, 0).label("tree_count"),
            func.coalesce(tree_person_sq.c.person_count, 0).label("person_count"),
            func.coalesce(tree_rel_sq.c.rel_count, 0).label("rel_count"),
            func.coalesce(tree_event_sq.c.event_count, 0).label("event_count"),
        )
        .outerjoin(last_login_sq, last_login_sq.c.user_id == User.id)
        .outerjoin(tree_count_sq, tree_count_sq.c.user_id == User.id)
        .outerjoin(tree_person_sq, tree_person_sq.c.user_id == User.id)
        .outerjoin(tree_rel_sq, tree_rel_sq.c.user_id == User.id)
        .outerjoin(tree_event_sq, tree_event_sq.c.user_id == User.id)
        .order_by(User.created_at.desc())
    )

    users = [
        UserRow(
            id=str(row.id),
            email=row.email,
            created_at=row.created_at.isoformat(),
            email_verified=row.email_verified,
            last_login=row.last_login.isoformat() if row.last_login else None,
            tree_count=row.tree_count,
            person_count=row.person_count,
            relationship_count=row.rel_count,
            event_count=row.event_count,
        )
        for row in result.all()
    ]

    return UserListStats(users=users)
