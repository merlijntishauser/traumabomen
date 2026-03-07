from app.models.life_event import LifeEvent, LifeEventPerson
from app.routers.crud_helpers import EntityConfig, create_linked_entity_router
from app.schemas.tree import LifeEventResponse

router = create_linked_entity_router(
    config=EntityConfig(
        model=LifeEvent,
        junction_model=LifeEventPerson,
        junction_fk="life_event_id",
        response_schema=LifeEventResponse,
        not_found_detail="Life event not found",
    ),
    prefix="life-events",
    tag="life-events",
)
