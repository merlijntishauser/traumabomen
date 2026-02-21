import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_owned_tree
from app.models.relationship import Relationship
from app.models.tree import Tree
from app.routers.crud_helpers import validate_persons_in_tree
from app.schemas.tree import RelationshipCreate, RelationshipResponse, RelationshipUpdate

router = APIRouter(prefix="/trees/{tree_id}/relationships", tags=["relationships"])


def _to_response(rel: Relationship) -> RelationshipResponse:
    return RelationshipResponse(
        id=rel.id,
        source_person_id=rel.source_person_id,
        target_person_id=rel.target_person_id,
        encrypted_data=rel.encrypted_data,
        created_at=rel.created_at,
        updated_at=rel.updated_at,
    )


@router.post("", response_model=RelationshipResponse, status_code=status.HTTP_201_CREATED)
async def create_relationship(
    body: RelationshipCreate,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> RelationshipResponse:
    await validate_persons_in_tree([body.source_person_id, body.target_person_id], tree.id, db)

    rel = Relationship(
        tree_id=tree.id,
        source_person_id=body.source_person_id,
        target_person_id=body.target_person_id,
        encrypted_data=body.encrypted_data,
    )
    db.add(rel)
    await db.commit()
    await db.refresh(rel)
    return _to_response(rel)


@router.get("", response_model=list[RelationshipResponse])
async def list_relationships(
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> list[RelationshipResponse]:
    result = await db.execute(select(Relationship).where(Relationship.tree_id == tree.id))
    rels = result.scalars().all()
    return [_to_response(r) for r in rels]


@router.get("/{relationship_id}", response_model=RelationshipResponse)
async def get_relationship(
    relationship_id: uuid.UUID,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> RelationshipResponse:
    result = await db.execute(
        select(Relationship).where(
            Relationship.id == relationship_id, Relationship.tree_id == tree.id
        )
    )
    rel = result.scalar_one_or_none()
    if rel is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Relationship not found")
    return _to_response(rel)


@router.put("/{relationship_id}", response_model=RelationshipResponse)
async def update_relationship(
    relationship_id: uuid.UUID,
    body: RelationshipUpdate,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> RelationshipResponse:
    result = await db.execute(
        select(Relationship).where(
            Relationship.id == relationship_id, Relationship.tree_id == tree.id
        )
    )
    rel = result.scalar_one_or_none()
    if rel is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Relationship not found")

    if body.source_person_id is not None:
        await validate_persons_in_tree([body.source_person_id], tree.id, db)
        rel.source_person_id = body.source_person_id
    if body.target_person_id is not None:
        await validate_persons_in_tree([body.target_person_id], tree.id, db)
        rel.target_person_id = body.target_person_id
    if body.encrypted_data is not None:
        rel.encrypted_data = body.encrypted_data

    await db.commit()
    await db.refresh(rel)
    return _to_response(rel)


@router.delete("/{relationship_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_relationship(
    relationship_id: uuid.UUID,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(Relationship).where(
            Relationship.id == relationship_id, Relationship.tree_id == tree.id
        )
    )
    rel = result.scalar_one_or_none()
    if rel is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Relationship not found")
    await db.delete(rel)
    await db.commit()
