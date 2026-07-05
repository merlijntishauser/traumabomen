from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.dependencies import get_owned_tree
from app.models.event import TraumaEvent
from app.models.life_event import LifeEvent
from app.models.pattern import Pattern
from app.models.person import Person
from app.models.tree import Tree
from app.models.turning_point import TurningPoint
from app.models.user import User
from app.routers.crud_helpers import build_tree_response
from app.schemas.tree import TreeCreate, TreeResponse, TreeUpdate

router = APIRouter(prefix="/trees", tags=["trees"])


@router.post("", response_model=TreeResponse, status_code=status.HTTP_201_CREATED)
async def create_tree(
    body: TreeCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TreeResponse:
    tree = Tree(user_id=user.id, encrypted_data=body.encrypted_data, is_demo=body.is_demo)
    db.add(tree)
    await db.commit()
    await db.refresh(tree)

    return build_tree_response(tree)


async def _counts_by_tree(
    db: AsyncSession,
    user_id: object,
    model: type[Person] | type[TraumaEvent] | type[LifeEvent] | type[TurningPoint] | type[Pattern],
) -> dict[object, int]:
    """Row counts per tree for one entity type: structure, never content."""
    result = await db.execute(
        select(model.tree_id, func.count())
        .join(Tree, Tree.id == model.tree_id)
        .where(Tree.user_id == user_id)
        .group_by(model.tree_id)
    )
    return {tree_id: count for tree_id, count in result.all()}


@router.get("", response_model=list[TreeResponse])
async def list_trees(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TreeResponse]:
    result = await db.execute(select(Tree).where(Tree.user_id == user.id))
    trees = result.scalars().all()

    persons = await _counts_by_tree(db, user.id, Person)
    patterns = await _counts_by_tree(db, user.id, Pattern)
    moments: dict[object, int] = {}
    for model in (TraumaEvent, LifeEvent, TurningPoint):
        for tree_id, count in (await _counts_by_tree(db, user.id, model)).items():
            moments[tree_id] = moments.get(tree_id, 0) + count

    responses = []
    for t in trees:
        response = build_tree_response(t)
        response.person_count = persons.get(t.id, 0)
        response.moment_count = moments.get(t.id, 0)
        response.pattern_count = patterns.get(t.id, 0)
        responses.append(response)
    return responses


@router.get("/{tree_id}", response_model=TreeResponse)
async def get_tree(
    tree: Tree = Depends(get_owned_tree),
) -> TreeResponse:
    return build_tree_response(tree)


@router.put("/{tree_id}", response_model=TreeResponse)
async def update_tree(
    body: TreeUpdate,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> TreeResponse:
    tree.encrypted_data = body.encrypted_data
    await db.commit()
    await db.refresh(tree)
    return build_tree_response(tree)


@router.delete("/{tree_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tree(
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> None:
    await db.delete(tree)
    await db.commit()
