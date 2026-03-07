from app.models.classification import Classification, ClassificationPerson
from app.routers.crud_helpers import EntityConfig, create_linked_entity_router
from app.schemas.tree import ClassificationResponse

router = create_linked_entity_router(
    config=EntityConfig(
        model=Classification,
        junction_model=ClassificationPerson,
        junction_fk="classification_id",
        response_schema=ClassificationResponse,
        not_found_detail="Classification not found",
    ),
    prefix="classifications",
    tag="classifications",
)
