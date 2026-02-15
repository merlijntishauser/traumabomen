"""Tests for app.database module (get_engine, get_session_factory, get_db)."""

from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from app.config import Settings
from app.database import get_db, get_engine, get_session_factory


@pytest.fixture(autouse=True)
def _clear_caches():
    """Clear lru_cache between tests so each test gets a fresh engine."""
    get_engine.cache_clear()
    get_session_factory.cache_clear()
    yield
    get_engine.cache_clear()
    get_session_factory.cache_clear()


@patch("app.database.create_async_engine")
@patch(
    "app.database.get_settings",
    return_value=Settings(
        DATABASE_URL="postgresql+asyncpg://u:p@localhost/db",
        JWT_SECRET_KEY="test-secret-key-that-is-at-least-32-bytes-long",
    ),
)
def test_get_engine_calls_create_async_engine(mock_settings, mock_create):
    mock_create.return_value = MagicMock(spec=AsyncEngine)
    engine = get_engine()
    mock_create.assert_called_once_with(
        "postgresql+asyncpg://u:p@localhost/db",
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
    )
    assert engine is mock_create.return_value


@patch("app.database.create_async_engine")
@patch(
    "app.database.get_settings",
    return_value=Settings(
        DATABASE_URL="postgresql+asyncpg://u:p@localhost/db",
        JWT_SECRET_KEY="test-secret-key-that-is-at-least-32-bytes-long",
    ),
)
def test_get_session_factory_returns_sessionmaker(mock_settings, mock_create):
    mock_create.return_value = MagicMock(spec=AsyncEngine)
    factory = get_session_factory()
    assert isinstance(factory, async_sessionmaker)


@patch("app.database.create_async_engine")
@patch(
    "app.database.get_settings",
    return_value=Settings(
        DATABASE_URL="sqlite+aiosqlite:///:memory:",
        JWT_SECRET_KEY="test-secret-key-that-is-at-least-32-bytes-long",
    ),
)
@pytest.mark.asyncio
async def test_get_db_yields_session(mock_settings, mock_create):
    """Verify get_db yields an AsyncSession from the session factory."""
    from sqlalchemy.ext.asyncio import create_async_engine as real_create

    # Use a real in-memory engine so the session actually works
    real_engine = real_create("sqlite+aiosqlite:///:memory:")
    mock_create.return_value = real_engine

    async for session in get_db():
        assert isinstance(session, AsyncSession)
        break

    await real_engine.dispose()
