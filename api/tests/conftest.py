"""Shared test fixtures.

Uses an in-memory SQLite database so tests don't require PostgreSQL.
The async engine is created once per session; each test gets its own
transaction that is rolled back automatically.
"""

import uuid
from datetime import datetime

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import DateTime, event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.expression import Extract
from sqlalchemy.sql.functions import GenericFunction

from app.auth import create_token, hash_password
from app.config import Settings
from app.database import Base, get_db
from app.main import app

# ---------------------------------------------------------------------------
# SQLite compatibility for PostgreSQL-specific SQL
# ---------------------------------------------------------------------------


@compiles(Extract, "sqlite")
def _sqlite_extract(element, compiler, **kw):
    """Support extract('isodow'/'hour'/etc.) on SQLite."""
    expr = compiler.process(element.expr, **kw)
    if element.field == "isodow":
        # Use a registered custom function to avoid %-escaping issues.
        return f"_pg_isodow({expr})"
    mapping = {
        "year": "%Y",
        "month": "%m",
        "day": "%d",
        "hour": "%H",
        "minute": "%M",
        "second": "%S",
    }
    fmt = mapping.get(element.field)
    if fmt:
        return f"CAST(STRFTIME('{fmt}', {expr}) AS INTEGER)"
    raise NotImplementedError(f"extract({element.field!r}) not supported on SQLite")


class DateTrunc(GenericFunction):
    """Override func.date_trunc so the return type is DateTime on all dialects."""

    type = DateTime()
    name = "date_trunc"
    inherit_cache = True


@compiles(DateTrunc, "sqlite")
def _sqlite_date_trunc(element, compiler, **kw):
    """Compile date_trunc('day', col) to SQLite DATETIME()."""
    args = list(element.clauses)
    expr = compiler.process(args[1], **kw)
    return f"DATETIME({expr}, 'start of day')"


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSession = async_sessionmaker(engine, expire_on_commit=False)


@event.listens_for(engine.sync_engine, "connect")
def _register_sqlite_functions(dbapi_conn, _connection_record):
    """Register PostgreSQL-compatible functions in SQLite."""

    def _pg_isodow(value):
        if value is None:
            return None
        dt = datetime.fromisoformat(value)
        return dt.isoweekday()  # 1=Monday .. 7=Sunday

    dbapi_conn.create_function("_pg_isodow", 1, _pg_isodow)


# SQLite doesn't preserve timezone info on DateTime(timezone=True) columns.
# Add UTC to naive datetimes when loading User objects so comparisons with
# datetime.now(UTC) in auth.py don't fail.
from datetime import UTC  # noqa: E402

from app.models.user import User as _User  # noqa: E402
from app.models.waitlist import WaitlistEntry as _WaitlistEntry  # noqa: E402


@event.listens_for(_User, "load")
def _fix_user_tz(target, _context):
    for attr in ("email_verification_expires_at", "created_at", "updated_at"):
        val = getattr(target, attr, None)
        if val is not None and val.tzinfo is None:
            object.__setattr__(target, attr, val.replace(tzinfo=UTC))


@event.listens_for(_WaitlistEntry, "load")
def _fix_waitlist_tz(target, _context):
    for attr in ("created_at", "approved_at", "invite_expires_at"):
        val = getattr(target, attr, None)
        if val is not None and val.tzinfo is None:
            object.__setattr__(target, attr, val.replace(tzinfo=UTC))


@pytest.fixture(autouse=True)
async def setup_database():
    """Create tables before each test, drop after."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def db_session():
    async with TestSession() as session:
        yield session


async def _override_get_db():
    async with TestSession() as session:
        yield session


app.dependency_overrides[get_db] = _override_get_db

# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

TEST_SETTINGS = Settings(
    DATABASE_URL=TEST_DATABASE_URL,
    JWT_SECRET_KEY="test-secret-key-that-is-at-least-32-bytes-long",
    REQUIRE_EMAIL_VERIFICATION=False,
)


def _override_get_settings():
    return TEST_SETTINGS


from app.config import get_settings  # noqa: E402

app.dependency_overrides[get_settings] = _override_get_settings

# ---------------------------------------------------------------------------
# HTTP client
# ---------------------------------------------------------------------------


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------


async def create_user(
    db: AsyncSession,
    email: str = "test@example.com",
    password: str = "password123",
    *,
    is_admin: bool = False,
):
    """Create a verified user directly in the database and return it."""
    from app.models.user import User

    user = User(
        email=email,
        hashed_password=hash_password(password),
        encryption_salt="test-salt-abc",
        email_verified=True,
        is_admin=is_admin,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


def auth_headers(user_id: uuid.UUID) -> dict:
    """Build Authorization header with a valid access token."""
    token = create_token(user_id, "access", TEST_SETTINGS)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def user(db_session):
    """Create and return a verified user."""
    return await create_user(db_session)


@pytest.fixture
async def headers(user):
    """Auth headers for the default user."""
    return auth_headers(user.id)


@pytest.fixture
async def admin_user(db_session):
    """Create and return a verified admin user."""
    return await create_user(db_session, email="admin@example.com", is_admin=True)


@pytest.fixture
async def admin_headers(admin_user):
    """Auth headers for the admin user."""
    return auth_headers(admin_user.id)


@pytest.fixture
async def tree(client, headers):
    """Create and return a tree for the default user."""
    resp = await client.post(
        "/trees", json={"encrypted_data": "encrypted-tree-data"}, headers=headers
    )
    assert resp.status_code == 201
    return resp.json()


@pytest.fixture
async def person(client, headers, tree):
    """Create and return a person in the default tree."""
    resp = await client.post(
        f"/trees/{tree['id']}/persons",
        json={"encrypted_data": "encrypted-person-data"},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()
