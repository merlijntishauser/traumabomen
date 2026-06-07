import logging
from collections.abc import Iterable

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings, get_settings
from app.routers.admin_feedback import router as admin_feedback_router
from app.routers.admin_stats import router as admin_stats_router
from app.routers.auth import router as auth_router
from app.routers.classifications import router as classifications_router
from app.routers.events import router as events_router
from app.routers.faq import admin_router as admin_faq_router
from app.routers.faq import router as faq_router
from app.routers.features import admin_router as admin_features_router
from app.routers.features import router as features_router
from app.routers.feedback import router as feedback_router
from app.routers.journal import router as journal_router
from app.routers.key_ring import router as key_ring_router
from app.routers.life_events import router as life_events_router
from app.routers.patterns import router as patterns_router
from app.routers.persons import router as persons_router
from app.routers.relationships import router as relationships_router
from app.routers.sibling_groups import router as sibling_groups_router
from app.routers.sync import router as sync_router
from app.routers.trees import router as trees_router
from app.routers.turning_points import router as turning_points_router
from app.routers.waitlist import router as waitlist_router


def _filter_encrypted_keys(d: dict) -> None:
    """Replace values of any key containing 'encrypted' with '[filtered]'."""
    for key in list(d.keys()):
        if "encrypted" in key.lower():
            d[key] = "[filtered]"


def _scrub_encrypted_fields(obj) -> None:
    """Recursively strip any key containing 'encrypted' from dicts/lists."""
    if isinstance(obj, dict):
        _filter_encrypted_keys(obj)
        children: Iterable = obj.values()
    elif isinstance(obj, list):
        children = obj
    else:
        return
    for child in children:
        _scrub_encrypted_fields(child)


def _strip_encrypted_data(event, hint):
    """Remove encrypted_data from Sentry event context."""
    request_data = event.get("request", {}).get("data")
    _scrub_encrypted_fields(request_data)
    return event


_settings = get_settings()


def _init_sentry(settings: Settings) -> None:
    """Initialise Sentry when a DSN is configured (production only)."""
    if not settings.SENTRY_DSN:
        return
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.SENTRY_ENVIRONMENT,
        release=settings.SENTRY_RELEASE,
        traces_sample_rate=0.1,
        send_default_pii=False,
        before_send=_strip_encrypted_data,
    )


_init_sentry(_settings)


class _HealthCheckLogFilter(logging.Filter):
    """Drop uvicorn access-log records for the container healthcheck (/health).

    The healthcheck polls /health every few seconds, which would otherwise flood
    the access log. uvicorn.access records carry the request as
    args = (client_addr, method, path, http_version, status_code).
    """

    def filter(self, record: logging.LogRecord) -> bool:
        args = record.args
        return not (isinstance(args, tuple) and len(args) >= 3 and args[2] == "/health")


logging.getLogger("uvicorn.access").addFilter(_HealthCheckLogFilter())

app = FastAPI(title="Traumabomen API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _settings.CORS_ORIGINS.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin_features_router)
app.include_router(admin_feedback_router)
app.include_router(admin_stats_router)
app.include_router(auth_router)
app.include_router(key_ring_router)
app.include_router(trees_router)
app.include_router(persons_router)
app.include_router(relationships_router)
app.include_router(events_router)
app.include_router(faq_router)
app.include_router(admin_faq_router)
app.include_router(features_router)
app.include_router(feedback_router)
app.include_router(journal_router)
app.include_router(life_events_router)
app.include_router(classifications_router)
app.include_router(patterns_router)
app.include_router(sync_router)
app.include_router(turning_points_router)
app.include_router(sibling_groups_router)
app.include_router(waitlist_router)

if _settings.ENABLE_TEST_RESET:
    from app.routers.testing import router as testing_router

    app.include_router(testing_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
