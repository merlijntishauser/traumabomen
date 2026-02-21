from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.admin_feedback import router as admin_feedback_router
from app.routers.admin_stats import router as admin_stats_router
from app.routers.auth import router as auth_router
from app.routers.classifications import router as classifications_router
from app.routers.events import router as events_router
from app.routers.feedback import router as feedback_router
from app.routers.life_events import router as life_events_router
from app.routers.patterns import router as patterns_router
from app.routers.persons import router as persons_router
from app.routers.relationships import router as relationships_router
from app.routers.sync import router as sync_router
from app.routers.trees import router as trees_router
from app.routers.waitlist import router as waitlist_router

app = FastAPI(title="Traumabomen API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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
app.include_router(life_events_router)
app.include_router(classifications_router)
app.include_router(patterns_router)
app.include_router(sync_router)
app.include_router(waitlist_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
