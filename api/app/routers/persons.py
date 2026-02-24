import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_owned_tree
from app.models.person import Person
from app.models.tree import Tree
from app.routers.crud_helpers import build_person_response, get_or_404
from app.schemas.tree import PersonCreate, PersonResponse, PersonUpdate

router = APIRouter(prefix="/trees/{tree_id}/persons", tags=["persons"])


@router.post("", response_model=PersonResponse, status_code=status.HTTP_201_CREATED)
async def create_person(
    body: PersonCreate,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> PersonResponse:
    person = Person(tree_id=tree.id, encrypted_data=body.encrypted_data)
    db.add(person)
    await db.commit()
    await db.refresh(person)
    return build_person_response(person)


@router.get("", response_model=list[PersonResponse])
async def list_persons(
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> list[PersonResponse]:
    result = await db.execute(select(Person).where(Person.tree_id == tree.id))
    persons = result.scalars().all()
    return [build_person_response(p) for p in persons]


@router.get("/{person_id}", response_model=PersonResponse)
async def get_person(
    person_id: uuid.UUID,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> PersonResponse:
    person = await get_or_404(
        db,
        select(Person).where(Person.id == person_id, Person.tree_id == tree.id),
        detail="Person not found",
    )
    return build_person_response(person)


@router.put("/{person_id}", response_model=PersonResponse)
async def update_person(
    person_id: uuid.UUID,
    body: PersonUpdate,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> PersonResponse:
    person = await get_or_404(
        db,
        select(Person).where(Person.id == person_id, Person.tree_id == tree.id),
        detail="Person not found",
    )
    person.encrypted_data = body.encrypted_data
    await db.commit()
    await db.refresh(person)
    return build_person_response(person)


@router.delete("/{person_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_person(
    person_id: uuid.UUID,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> None:
    person = await get_or_404(
        db,
        select(Person).where(Person.id == person_id, Person.tree_id == tree.id),
        detail="Person not found",
    )
    await db.delete(person)
    await db.commit()
