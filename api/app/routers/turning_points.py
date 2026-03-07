from app.models.turning_point import TurningPoint, TurningPointPerson
from app.routers.crud_helpers import EntityConfig, create_linked_entity_router
from app.schemas.tree import TurningPointResponse

router = create_linked_entity_router(
    config=EntityConfig(
        model=TurningPoint,
        junction_model=TurningPointPerson,
        junction_fk="turning_point_id",
        response_schema=TurningPointResponse,
        not_found_detail="Turning point not found",
    ),
    prefix="turning-points",
    tag="turning-points",
)
