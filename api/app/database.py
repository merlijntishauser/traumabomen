import uuid
from collections.abc import AsyncGenerator
from functools import lru_cache

from sqlalchemy import ForeignKey
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.config import get_settings


class Base(DeclarativeBase):
    pass


class JunctionModel(Base):
    """Abstract base for person junction tables.

    Declares ``person_id`` so mypy can resolve class-level attribute access
    on dynamically generated junction models.
    """

    __abstract__ = True

    person_id: Mapped[uuid.UUID]


def make_junction_model(
    class_name: str,
    table_name: str,
    entity_fk_name: str,
    entity_table: str,
) -> type[JunctionModel]:
    """Create a junction table model linking an entity to persons.

    Returns a real SQLAlchemy mapped class (subclass of JunctionModel) that
    Alembic can detect for autogenerate migrations. The class has two
    composite primary key columns: ``entity_fk_name`` -> ``entity_table.id``
    and ``person_id`` -> ``persons.id``, both with CASCADE deletes.
    """
    entity_fk_col: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(f"{entity_table}.id", ondelete="CASCADE"), primary_key=True
    )
    person_id_col: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("persons.id", ondelete="CASCADE"), primary_key=True
    )

    cls = type(
        class_name,
        (JunctionModel,),
        {
            "__tablename__": table_name,
            "__annotations__": {
                entity_fk_name: Mapped[uuid.UUID],
                "person_id": Mapped[uuid.UUID],
            },
            entity_fk_name: entity_fk_col,
            "person_id": person_id_col,
        },
    )
    return cls  # type: ignore[return-value]


@lru_cache
def get_engine() -> AsyncEngine:
    settings = get_settings()
    connect_args: dict[str, object] = {}
    if settings.DATABASE_SSL:
        import ssl

        connect_args["ssl"] = ssl.create_default_context()
    return create_async_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
        connect_args=connect_args,
    )


@lru_cache
def get_session_factory() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(get_engine(), expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession]:
    async with get_session_factory()() as session:
        yield session
