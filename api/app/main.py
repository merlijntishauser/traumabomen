from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.auth import router as auth_router
from app.routers.trees import router as trees_router
from app.routers.persons import router as persons_router
from app.routers.relationships import router as relationships_router
from app.routers.events import router as events_router
from app.routers.life_events import router as life_events_router
from app.routers.sync import router as sync_router

app = FastAPI(title="Traumabomen API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(trees_router)
app.include_router(persons_router)
app.include_router(relationships_router)
app.include_router(events_router)
app.include_router(life_events_router)
app.include_router(sync_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
