"""Tests for app.database module (get_engine, get_session_factory, get_db, make_junction_model)."""

from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from app.config import Settings
from app.database import Base, get_db, get_engine, get_session_factory


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
    mock_create.assert_called_once()
    args, kwargs = mock_create.call_args
    assert args == ("postgresql+asyncpg://u:p@localhost/db",)
    assert kwargs["pool_pre_ping"] is True
    assert kwargs["pool_size"] == 5
    assert kwargs["max_overflow"] == 10
    import ssl

    assert isinstance(kwargs["connect_args"]["ssl"], ssl.SSLContext)
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


class TestMakeJunctionModel:
    """Tests for the make_junction_model factory."""

    def test_creates_base_subclass(self):
        """The generated class must inherit from Base for Alembic detection."""
        from app.models.event import EventPerson

        assert issubclass(EventPerson, Base)

    def test_has_correct_tablename(self):
        from app.models.event import EventPerson

        assert EventPerson.__tablename__ == "event_persons"

    def test_has_entity_fk_column(self):
        from app.models.event import EventPerson

        assert hasattr(EventPerson, "event_id")

    def test_has_person_id_column(self):
        from app.models.event import EventPerson

        assert hasattr(EventPerson, "person_id")

    def test_class_name_is_correct(self):
        from app.models.event import EventPerson

        assert EventPerson.__name__ == "EventPerson"

    def test_all_junction_models_are_base_subclasses(self):
        """All five junction models produced by the factory are real Base subclasses."""
        from app.models.classification import ClassificationPerson
        from app.models.event import EventPerson
        from app.models.life_event import LifeEventPerson
        from app.models.pattern import PatternPerson
        from app.models.turning_point import TurningPointPerson

        for model in (
            EventPerson,
            LifeEventPerson,
            ClassificationPerson,
            PatternPerson,
            TurningPointPerson,
        ):
            assert issubclass(model, Base), f"{model.__name__} is not a Base subclass"
