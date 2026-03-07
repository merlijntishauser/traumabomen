from app.models.pattern import Pattern, PatternPerson
from app.routers.crud_helpers import EntityConfig, create_linked_entity_router
from app.schemas.tree import PatternResponse

router = create_linked_entity_router(
    config=EntityConfig(
        model=Pattern,
        junction_model=PatternPerson,
        junction_fk="pattern_id",
        response_schema=PatternResponse,
        not_found_detail="Pattern not found",
    ),
    prefix="patterns",
    tag="patterns",
)
