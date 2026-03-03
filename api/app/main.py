import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers.admin_feedback import router as admin_feedback_router
from app.routers.admin_stats import router as admin_stats_router
from app.routers.auth import router as auth_router
from app.routers.classifications import router as classifications_router
from app.routers.events import router as events_router
from app.routers.feedback import router as feedback_router
from app.routers.journal import router as journal_router
from app.routers.life_events import router as life_events_router
from app.routers.patterns import router as patterns_router
from app.routers.persons import router as persons_router
from app.routers.relationships import router as relationships_router
from app.routers.sync import router as sync_router
from app.routers.trees import router as trees_router
from app.routers.turning_points import router as turning_points_router
from app.routers.waitlist import router as waitlist_router


def _strip_encrypted_data(event, hint):
    """Remove encrypted_data from request body context."""
    request_data = event.get("request", {}).get("data")
    if isinstance(request_data, dict):
        for key in list(request_data.keys()):
            if "encrypted" in key.lower():
                request_data[key] = "[filtered]"
    return event


_settings = get_settings()
if _settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=_settings.SENTRY_DSN,
        environment=_settings.SENTRY_ENVIRONMENT,
        release=_settings.SENTRY_RELEASE,
        traces_sample_rate=0.1,
        send_default_pii=False,
        before_send=_strip_encrypted_data,
    )

app = FastAPI(title="Traumabomen API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _settings.CORS_ORIGINS.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin_feedback_router)
app.include_router(admin_stats_router)
app.include_router(auth_router)
app.include_router(trees_router)
app.include_router(persons_router)
app.include_router(relationships_router)
app.include_router(events_router)
app.include_router(feedback_router)
app.include_router(journal_router)
app.include_router(life_events_router)
app.include_router(classifications_router)
app.include_router(patterns_router)
app.include_router(sync_router)
app.include_router(turning_points_router)
app.include_router(waitlist_router)

if _settings.ENABLE_TEST_RESET:
    from app.routers.testing import router as testing_router

    app.include_router(testing_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
