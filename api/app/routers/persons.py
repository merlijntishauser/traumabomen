import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_owned_tree
from app.models.person import Person
from app.models.tree import Tree
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
    return PersonResponse(
        id=person.id,
        encrypted_data=person.encrypted_data,
        created_at=person.created_at,
        updated_at=person.updated_at,
    )


@router.get("", response_model=list[PersonResponse])
async def list_persons(
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> list[PersonResponse]:
    result = await db.execute(select(Person).where(Person.tree_id == tree.id))
    persons = result.scalars().all()
    return [
        PersonResponse(
            id=p.id,
            encrypted_data=p.encrypted_data,
            created_at=p.created_at,
            updated_at=p.updated_at,
        )
        for p in persons
    ]


@router.get("/{person_id}", response_model=PersonResponse)
async def get_person(
    person_id: uuid.UUID,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> PersonResponse:
    result = await db.execute(
        select(Person).where(Person.id == person_id, Person.tree_id == tree.id)
    )
    person = result.scalar_one_or_none()
    if person is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Person not found"
        )
    return PersonResponse(
        id=person.id,
        encrypted_data=person.encrypted_data,
        created_at=person.created_at,
        updated_at=person.updated_at,
    )


@router.put("/{person_id}", response_model=PersonResponse)
async def update_person(
    person_id: uuid.UUID,
    body: PersonUpdate,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> PersonResponse:
    result = await db.execute(
        select(Person).where(Person.id == person_id, Person.tree_id == tree.id)
    )
    person = result.scalar_one_or_none()
    if person is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Person not found"
        )
    person.encrypted_data = body.encrypted_data
    await db.commit()
    await db.refresh(person)
    return PersonResponse(
        id=person.id,
        encrypted_data=person.encrypted_data,
        created_at=person.created_at,
        updated_at=person.updated_at,
    )


@router.delete("/{person_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_person(
    person_id: uuid.UUID,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(Person).where(Person.id == person_id, Person.tree_id == tree.id)
    )
    person = result.scalar_one_or_none()
    if person is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Person not found"
        )
    await db.delete(person)
    await db.commit()
