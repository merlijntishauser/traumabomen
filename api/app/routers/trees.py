from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.dependencies import get_owned_tree
from app.models.tree import Tree
from app.models.user import User
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

    return TreeResponse(
        id=tree.id,
        encrypted_data=tree.encrypted_data,
        is_demo=tree.is_demo,
        created_at=tree.created_at,
        updated_at=tree.updated_at,
    )


@router.get("", response_model=list[TreeResponse])
async def list_trees(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TreeResponse]:
    result = await db.execute(select(Tree).where(Tree.user_id == user.id))
    trees = result.scalars().all()
    return [
        TreeResponse(
            id=t.id,
            encrypted_data=t.encrypted_data,
            is_demo=t.is_demo,
            created_at=t.created_at,
            updated_at=t.updated_at,
        )
        for t in trees
    ]


@router.get("/{tree_id}", response_model=TreeResponse)
async def get_tree(
    tree: Tree = Depends(get_owned_tree),
) -> TreeResponse:
    return TreeResponse(
        id=tree.id,
        encrypted_data=tree.encrypted_data,
        is_demo=tree.is_demo,
        created_at=tree.created_at,
        updated_at=tree.updated_at,
    )


@router.put("/{tree_id}", response_model=TreeResponse)
async def update_tree(
    body: TreeUpdate,
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> TreeResponse:
    tree.encrypted_data = body.encrypted_data
    await db.commit()
    await db.refresh(tree)
    return TreeResponse(
        id=tree.id,
        encrypted_data=tree.encrypted_data,
        is_demo=tree.is_demo,
        created_at=tree.created_at,
        updated_at=tree.updated_at,
    )


@router.delete("/{tree_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tree(
    tree: Tree = Depends(get_owned_tree),
    db: AsyncSession = Depends(get_db),
) -> None:
    await db.delete(tree)
    await db.commit()
