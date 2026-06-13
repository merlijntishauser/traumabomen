"""Integration test fixtures.

By default uses an in-memory SQLite database so a plain ``pytest`` needs no
running services. Set ``TEST_DATABASE_URL`` to run against PostgreSQL instead:
CI points it at the Postgres service so the suite exercises the same engine
(and version) as production, and a developer can do the same locally against
the docker-compose ``db``. The schema is created and dropped per test.
"""

import os
import uuid
from datetime import datetime

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import DateTime, event, text
from sqlalchemy.ext.asyncio import (
    AsyncConnection,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.pool import NullPool
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

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
_IS_SQLITE = TEST_DATABASE_URL.startswith("sqlite")

# In-memory SQLite must share its single connection, which SQLAlchemy arranges
# with a StaticPool automatically. asyncpg connections are bound to the event
# loop that opened them, and pytest-asyncio uses a fresh loop per test, so on
# PostgreSQL use NullPool to open a new connection inside each test's loop
# rather than handing back one created under a now-closed loop.
if _IS_SQLITE:
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
else:
    engine = create_async_engine(TEST_DATABASE_URL, echo=False, poolclass=NullPool)

TestSession = async_sessionmaker(engine, expire_on_commit=False)


def _register_sqlite_functions(dbapi_conn, _connection_record):
    """Register PostgreSQL-compatible functions on the SQLite connection."""

    def _pg_isodow(value):
        if value is None:
            return None
        dt = datetime.fromisoformat(value)
        return dt.isoweekday()  # 1=Monday .. 7=Sunday

    dbapi_conn.create_function("_pg_isodow", 1, _pg_isodow)


# Only SQLite needs the helper function and the compile shims below; on
# PostgreSQL extract()/date_trunc() are native, so this hook (which calls the
# sqlite3-only create_function) must not be attached to an asyncpg connection.
if _IS_SQLITE:
    event.listen(engine.sync_engine, "connect", _register_sqlite_functions)


# SQLite doesn't preserve timezone info on DateTime(timezone=True) columns.
# Add UTC to naive datetimes when loading User objects so comparisons with
# datetime.now(UTC) in auth.py don't fail.
from datetime import UTC  # noqa: E402

from app.models.refresh_token import RefreshToken as _RefreshToken  # noqa: E402
from app.models.user import User as _User  # noqa: E402
from app.models.waitlist import WaitlistEntry as _WaitlistEntry  # noqa: E402


@event.listens_for(_User, "load")
def _fix_user_tz(target, _context):
    for attr in (
        "email_verification_expires_at",
        "password_reset_expires_at",
        "last_active_at",
        "created_at",
        "updated_at",
    ):
        val = getattr(target, attr, None)
        if val is not None and val.tzinfo is None:
            object.__setattr__(target, attr, val.replace(tzinfo=UTC))


@event.listens_for(_WaitlistEntry, "load")
def _fix_waitlist_tz(target, _context):
    for attr in ("created_at", "approved_at", "invite_expires_at"):
        val = getattr(target, attr, None)
        if val is not None and val.tzinfo is None:
            object.__setattr__(target, attr, val.replace(tzinfo=UTC))


@event.listens_for(_RefreshToken, "load")
def _fix_refresh_token_tz(target, _context):
    for attr in ("expires_at", "created_at"):
        val = getattr(target, attr, None)
        if val is not None and val.tzinfo is None:
            object.__setattr__(target, attr, val.replace(tzinfo=UTC))


_schema_ready = False


async def _reset_data(conn: AsyncConnection) -> None:
    """Empty every table between tests without recreating the schema."""
    if _IS_SQLITE:
        # No TRUNCATE in SQLite; delete children before parents.
        for table in reversed(Base.metadata.sorted_tables):
            await conn.execute(table.delete())
    else:
        names = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
        await conn.execute(text(f"TRUNCATE {names} RESTART IDENTITY CASCADE"))


@pytest.fixture(autouse=True)
async def setup_database():
    """Share the schema across the session; reset only the data between tests.

    Creating and dropping every table per test is cheap on in-memory SQLite but
    expensive on PostgreSQL, where it pushed the CI suite past the deploy gate's
    wait. The first test drops any schema left by a previous run and recreates
    it; every later test just truncates, so each test still starts from an empty
    database.
    """
    global _schema_ready
    async with engine.begin() as conn:
        if not _schema_ready:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
            _schema_ready = True
        else:
            await _reset_data(conn)
    yield


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
    ENABLE_TEST_RESET=True,
)


def _override_get_settings():
    return TEST_SETTINGS


from app.config import get_settings  # noqa: E402

app.dependency_overrides[get_settings] = _override_get_settings

# Register the testing router directly since the conditional check in main.py
# runs at import time before the settings override takes effect.
from app.routers.testing import router as testing_router  # noqa: E402

app.include_router(testing_router)

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
    password: str = "TestPassword1",
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


async def create_test_refresh_token(db: AsyncSession, user_id: uuid.UUID) -> str:
    """Create an opaque refresh token for testing."""
    from app.auth import create_refresh_token

    family_id = uuid.uuid4()
    plaintext = await create_refresh_token(user_id, family_id, db, TEST_SETTINGS)
    await db.commit()
    return plaintext


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
