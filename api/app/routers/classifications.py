import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_owned_tree
from app.models.classification import Classification, ClassificationPerson
from app.models.person import Person
from app.models.tree import Tree
from app.schemas.tree import ClassificationCreate, ClassificationResponse, ClassificationUpdate

router = APIRouter(prefix="/trees/{tree_id}/classifications", tags=["classifications"])


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


def _classification_response(classification: Classification) -> ClassificationResponse:
    return ClassificationResponse(
        id=classification.id,
        person_ids=[link.person_id for link in classification.person_links],
        encrypted_data=classification.encrypted_data,
        created_at=classification.created_at,
        updated_at=classification.updated_at,
    )


@router.post("", response_model=ClassificationResponse, status_code=status.HTTP_201_CREATED)
async def create_classification(
    body: ClassificationCreate,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> ClassificationResponse:
    await _validate_persons_in_tree(body.person_ids, tree.id, db)

    classification = Classification(tree_id=tree.id, encrypted_data=body.encrypted_data)
    db.add(classification)
    await db.flush()
    for pid in body.person_ids:
        db.add(ClassificationPerson(classification_id=classification.id, person_id=pid))
    await db.commit()
    await db.refresh(classification, ["person_links"])
    return _classification_response(classification)


@router.get("", response_model=list[ClassificationResponse])
async def list_classifications(
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> list[ClassificationResponse]:
    result = await db.execute(
        select(Classification)
        .where(Classification.tree_id == tree.id)
        .options(selectinload(Classification.person_links))
    )
    classifications = result.scalars().all()
    return [_classification_response(c) for c in classifications]


@router.get("/{classification_id}", response_model=ClassificationResponse)
async def get_classification(
    classification_id: uuid.UUID,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> ClassificationResponse:
    result = await db.execute(
        select(Classification).where(
            Classification.id == classification_id, Classification.tree_id == tree.id
        )
    )
    classification = result.scalar_one_or_none()
    if classification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Classification not found"
        )
    await db.refresh(classification, ["person_links"])
    return _classification_response(classification)


@router.put("/{classification_id}", response_model=ClassificationResponse)
async def update_classification(
    classification_id: uuid.UUID,
    body: ClassificationUpdate,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> ClassificationResponse:
    result = await db.execute(
        select(Classification).where(
            Classification.id == classification_id, Classification.tree_id == tree.id
        )
    )
    classification = result.scalar_one_or_none()
    if classification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Classification not found"
        )

    if body.encrypted_data is not None:
        classification.encrypted_data = body.encrypted_data

    if body.person_ids is not None:
        await _validate_persons_in_tree(body.person_ids, tree.id, db)
        await db.refresh(classification, ["person_links"])
        classification.person_links.clear()
        await db.flush()
        for pid in body.person_ids:
            db.add(ClassificationPerson(classification_id=classification.id, person_id=pid))

    await db.commit()
    await db.refresh(classification)
    await db.refresh(classification, ["person_links"])
    return _classification_response(classification)


@router.delete("/{classification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_classification(
    classification_id: uuid.UUID,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(Classification).where(
            Classification.id == classification_id, Classification.tree_id == tree.id
        )
    )
    classification = result.scalar_one_or_none()
    if classification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Classification not found"
        )
    await db.delete(classification)
    await db.commit()
