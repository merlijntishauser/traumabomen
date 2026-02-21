import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_owned_tree
from app.models.classification import Classification, ClassificationPerson
from app.models.tree import Tree
from app.routers.crud_helpers import (
    EntityConfig,
    create_entity,
    delete_entity,
    get_entity,
    list_entities,
    update_entity,
)
from app.schemas.tree import ClassificationCreate, ClassificationResponse, ClassificationUpdate

router = APIRouter(prefix="/trees/{tree_id}/classifications", tags=["classifications"])

_config = EntityConfig(
    model=Classification,
    junction_model=ClassificationPerson,
    junction_fk="classification_id",
    response_schema=ClassificationResponse,
    not_found_detail="Classification not found",
)


@router.post("", response_model=ClassificationResponse, status_code=status.HTTP_201_CREATED)
async def create_classification(
    body: ClassificationCreate,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> ClassificationResponse:
    return await create_entity(_config, body.person_ids, body.encrypted_data, tree.id, db)  # type: ignore[return-value]


@router.get("", response_model=list[ClassificationResponse])
async def list_classifications(
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> list[ClassificationResponse]:
    return await list_entities(_config, tree.id, db)  # type: ignore[return-value]


@router.get("/{classification_id}", response_model=ClassificationResponse)
async def get_classification(
    classification_id: uuid.UUID,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> ClassificationResponse:
    return await get_entity(_config, classification_id, tree.id, db)  # type: ignore[return-value]


@router.put("/{classification_id}", response_model=ClassificationResponse)
async def update_classification(
    classification_id: uuid.UUID,
    body: ClassificationUpdate,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> ClassificationResponse:
    return await update_entity(
        _config, classification_id, tree.id, body.encrypted_data, body.person_ids, db
    )  # type: ignore[return-value]


@router.delete("/{classification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_classification(
    classification_id: uuid.UUID,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> None:
    await delete_entity(_config, classification_id, tree.id, db)
