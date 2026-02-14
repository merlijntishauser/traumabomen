"""Shared test fixtures.

Uses an in-memory SQLite database so tests don't require PostgreSQL.
The async engine is created once per session; each test gets its own
transaction that is rolled back automatically.
"""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.auth import create_token, hash_password
from app.config import Settings
from app.database import Base, get_db
from app.main import app

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSession = async_sessionmaker(engine, expire_on_commit=False)


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
    JWT_SECRET_KEY="test-secret-key",
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


async def create_user(db: AsyncSession, email: str = "test@example.com", password: str = "password123"):
    """Create a verified user directly in the database and return it."""
    from app.models.user import User

    user = User(
        email=email,
        hashed_password=hash_password(password),
        encryption_salt="test-salt-abc",
        email_verified=True,
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
async def tree(client, headers):
    """Create and return a tree for the default user."""
    resp = await client.post("/trees", json={"encrypted_data": "encrypted-tree-data"}, headers=headers)
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
