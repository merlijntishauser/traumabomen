from app.models.event import EventPerson, TraumaEvent
from app.routers.crud_helpers import EntityConfig, create_linked_entity_router
from app.schemas.tree import EventResponse

router = create_linked_entity_router(
    config=EntityConfig(
        model=TraumaEvent,
        junction_model=EventPerson,
        junction_fk="event_id",
        response_schema=EventResponse,
        not_found_detail="Event not found",
    ),
    prefix="events",
    tag="events",
)
