import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_owned_tree
from app.models.pattern import Pattern, PatternPerson
from app.models.person import Person
from app.models.tree import Tree
from app.schemas.tree import PatternCreate, PatternResponse, PatternUpdate

router = APIRouter(prefix="/trees/{tree_id}/patterns", tags=["patterns"])


async def _validate_persons_in_tree(
    person_ids: list[uuid.UUID], tree_id: uuid.UUID, db: AsyncSession
) -> None:
    if not person_ids:
        return
    result = await db.execute(
        select(Person.id).where(Person.tree_id == tree_id, Person.id.in_(person_ids))
    )
    found = {row[0] for row in result.all()}
    missing = set(person_ids) - found
    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"person_ids not found in this tree: {[str(m) for m in missing]}",
        )


def _pattern_response(pattern: Pattern) -> PatternResponse:
    return PatternResponse(
        id=pattern.id,
        person_ids=[link.person_id for link in pattern.person_links],
        encrypted_data=pattern.encrypted_data,
        created_at=pattern.created_at,
        updated_at=pattern.updated_at,
    )


@router.post("", response_model=PatternResponse, status_code=status.HTTP_201_CREATED)
async def create_pattern(
    body: PatternCreate,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> PatternResponse:
    await _validate_persons_in_tree(body.person_ids, tree.id, db)

    pattern = Pattern(tree_id=tree.id, encrypted_data=body.encrypted_data)
    db.add(pattern)
    await db.flush()
    for pid in body.person_ids:
        db.add(PatternPerson(pattern_id=pattern.id, person_id=pid))
    await db.commit()
    await db.refresh(pattern, ["person_links"])
    return _pattern_response(pattern)


@router.get("", response_model=list[PatternResponse])
async def list_patterns(
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> list[PatternResponse]:
    result = await db.execute(
        select(Pattern)
        .where(Pattern.tree_id == tree.id)
        .options(selectinload(Pattern.person_links))
    )
    patterns = result.scalars().all()
    return [_pattern_response(p) for p in patterns]


@router.get("/{pattern_id}", response_model=PatternResponse)
async def get_pattern(
    pattern_id: uuid.UUID,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> PatternResponse:
    result = await db.execute(
        select(Pattern).where(Pattern.id == pattern_id, Pattern.tree_id == tree.id)
    )
    pattern = result.scalar_one_or_none()
    if pattern is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pattern not found")
    await db.refresh(pattern, ["person_links"])
    return _pattern_response(pattern)


@router.put("/{pattern_id}", response_model=PatternResponse)
async def update_pattern(
    pattern_id: uuid.UUID,
    body: PatternUpdate,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> PatternResponse:
    result = await db.execute(
        select(Pattern).where(Pattern.id == pattern_id, Pattern.tree_id == tree.id)
    )
    pattern = result.scalar_one_or_none()
    if pattern is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pattern not found")

    if body.encrypted_data is not None:
        pattern.encrypted_data = body.encrypted_data

    if body.person_ids is not None:
        await _validate_persons_in_tree(body.person_ids, tree.id, db)
        await db.refresh(pattern, ["person_links"])
        pattern.person_links.clear()
        await db.flush()
        for pid in body.person_ids:
            db.add(PatternPerson(pattern_id=pattern.id, person_id=pid))

    await db.commit()
    await db.refresh(pattern)
    await db.refresh(pattern, ["person_links"])
    return _pattern_response(pattern)


@router.delete("/{pattern_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pattern(
    pattern_id: uuid.UUID,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(Pattern).where(Pattern.id == pattern_id, Pattern.tree_id == tree.id)
    )
    pattern = result.scalar_one_or_none()
    if pattern is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pattern not found")
    await db.delete(pattern)
    await db.commit()
