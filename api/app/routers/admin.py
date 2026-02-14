from datetime import UTC, datetime, timedelta

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
    CohortRow,
    OverviewStats,
    PeriodCounts,
    RetentionStats,
    UsageBuckets,
    UsageStats,
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


@router.get("/stats/retention", response_model=RetentionStats)
async def retention_stats(
    db: AsyncSession = Depends(get_db),
    weeks: int = Query(default=12, ge=1, le=52),
) -> RetentionStats:
    now = datetime.now(UTC)
    cutoff = now - timedelta(weeks=weeks)

    # Get all users who signed up since cutoff
    result = await db.execute(
        select(User.id, User.created_at).where(User.created_at >= cutoff).order_by(User.created_at)
    )
    users = result.all()

    if not users:
        return RetentionStats(cohorts=[])

    # Get all login events for these users since cutoff
    user_ids = [u.id for u in users]
    login_result = await db.execute(
        select(LoginEvent.user_id, LoginEvent.logged_at).where(
            LoginEvent.user_id.in_(user_ids),
            LoginEvent.logged_at >= cutoff,
        )
    )
    logins = login_result.all()

    # Build lookup: user_id -> set of week offsets they were active
    user_active_weeks: dict[str, set[int]] = {}
    user_signup_week: dict[str, datetime] = {}
    for u in users:
        user_signup_week[str(u.id)] = u.created_at

    for login in logins:
        uid = str(login.user_id)
        signup = user_signup_week.get(uid)
        if signup is None:
            continue
        week_offset = (login.logged_at - signup).days // 7
        if uid not in user_active_weeks:
            user_active_weeks[uid] = set()
        user_active_weeks[uid].add(week_offset)

    # Group users by signup week (Monday-aligned)
    cohort_users: dict[str, list[str]] = {}
    for u in users:
        # Truncate to Monday of that week
        week_start = u.created_at - timedelta(days=u.created_at.weekday())
        week_key = week_start.strftime("%Y-%m-%d")
        if week_key not in cohort_users:
            cohort_users[week_key] = []
        cohort_users[week_key].append(str(u.id))

    # Build cohort rows
    cohorts: list[CohortRow] = []
    for week_key in sorted(cohort_users.keys()):
        uids = cohort_users[week_key]
        signup_count = len(uids)

        # How many weeks has this cohort existed?
        cohort_start = datetime.strptime(week_key, "%Y-%m-%d").replace(tzinfo=UTC)
        max_weeks = min(weeks, (now - cohort_start).days // 7 + 1)

        retention: list[float] = []
        for w in range(max_weeks):
            active_count = sum(1 for uid in uids if w in user_active_weeks.get(uid, set()))
            retention.append(round(active_count / signup_count * 100, 1) if signup_count > 0 else 0)

        cohorts.append(CohortRow(week=week_key, signup_count=signup_count, retention=retention))

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
