import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_owned_tree
from app.models.journal_entry import JournalEntry
from app.models.tree import Tree
from app.routers.crud_helpers import build_journal_entry_response, get_or_404
from app.schemas.tree import JournalEntryCreate, JournalEntryResponse, JournalEntryUpdate

router = APIRouter(prefix="/trees/{tree_id}/journal", tags=["journal"])


@router.post("", response_model=JournalEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_journal_entry(
    body: JournalEntryCreate,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> JournalEntryResponse:
    entry = JournalEntry(tree_id=tree.id, encrypted_data=body.encrypted_data)
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return build_journal_entry_response(entry)


@router.get("", response_model=list[JournalEntryResponse])
async def list_journal_entries(
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> list[JournalEntryResponse]:
    result = await db.execute(
        select(JournalEntry)
        .where(JournalEntry.tree_id == tree.id)
        .order_by(JournalEntry.created_at.desc())
    )
    entries = result.scalars().all()
    return [build_journal_entry_response(e) for e in entries]


@router.put("/{entry_id}", response_model=JournalEntryResponse)
async def update_journal_entry(
    entry_id: uuid.UUID,
    body: JournalEntryUpdate,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> JournalEntryResponse:
    entry = await get_or_404(
        db,
        select(JournalEntry).where(JournalEntry.id == entry_id, JournalEntry.tree_id == tree.id),
        detail="Journal entry not found",
    )
    entry.encrypted_data = body.encrypted_data
    await db.commit()
    await db.refresh(entry)
    return build_journal_entry_response(entry)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_journal_entry(
    entry_id: uuid.UUID,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> None:
    entry = await get_or_404(
        db,
        select(JournalEntry).where(JournalEntry.id == entry_id, JournalEntry.tree_id == tree.id),
        detail="Journal entry not found",
    )
    await db.delete(entry)
    await db.commit()
