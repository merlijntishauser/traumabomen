import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.auth import require_admin
from app.database import get_db
from app.models.faq import FAQEntry
from app.schemas.faq import (
    AdminFaqEntry,
    AdminFaqListResponse,
    FaqEntry,
    FaqEntryInput,
    FaqListResponse,
)

router = APIRouter(tags=["faq"])
admin_router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

_ORDER = (FAQEntry.sort_order, FAQEntry.created_at)


@router.get("/faq", response_model=FaqListResponse)
async def get_faq(db: AsyncSession = Depends(get_db)) -> FaqListResponse:
    """Public: published FAQ entries, ordered. Consumed by the landing page."""
    result = await db.execute(
        select(FAQEntry).where(FAQEntry.published.is_(True)).order_by(*_ORDER)
    )
    return FaqListResponse(entries=[FaqEntry.model_validate(e) for e in result.scalars().all()])


@admin_router.get("/faq", response_model=AdminFaqListResponse)
async def admin_list_faq(db: AsyncSession = Depends(get_db)) -> AdminFaqListResponse:
    """All FAQ entries including drafts (admin only)."""
    result = await db.execute(select(FAQEntry).order_by(*_ORDER))
    return AdminFaqListResponse(
        entries=[AdminFaqEntry.model_validate(e) for e in result.scalars().all()]
    )


@admin_router.post("/faq", response_model=AdminFaqEntry, status_code=status.HTTP_201_CREATED)
async def admin_create_faq(
    body: FaqEntryInput, db: AsyncSession = Depends(get_db)
) -> AdminFaqEntry:
    """Create a FAQ entry (admin only)."""
    entry = FAQEntry(**body.model_dump())
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return AdminFaqEntry.model_validate(entry)


async def _get_entry_or_404(db: AsyncSession, entry_id: uuid.UUID) -> FAQEntry:
    result = await db.execute(select(FAQEntry).where(FAQEntry.id == entry_id))
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="FAQ entry not found")
    return entry


@admin_router.put("/faq/{entry_id}", response_model=AdminFaqEntry)
async def admin_update_faq(
    entry_id: uuid.UUID, body: FaqEntryInput, db: AsyncSession = Depends(get_db)
) -> AdminFaqEntry:
    """Update a FAQ entry's content, ordering, and published state (admin only)."""
    entry = await _get_entry_or_404(db, entry_id)
    for field, value in body.model_dump().items():
        setattr(entry, field, value)
    await db.commit()
    await db.refresh(entry)
    return AdminFaqEntry.model_validate(entry)


@admin_router.delete("/faq/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_faq(entry_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> None:
    """Delete a FAQ entry (admin only)."""
    entry = await _get_entry_or_404(db, entry_id)
    await db.delete(entry)
    await db.commit()
