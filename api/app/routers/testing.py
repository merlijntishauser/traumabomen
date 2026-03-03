from fastapi import APIRouter, Depends
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import Base, get_db

router = APIRouter()


@router.post("/test/reset", status_code=204)
async def reset_database(db: AsyncSession = Depends(get_db)) -> None:
    """Delete all rows from all tables. Only available when ENABLE_TEST_RESET is true."""
    for table in reversed(Base.metadata.sorted_tables):
        await db.execute(delete(table))
    await db.commit()
