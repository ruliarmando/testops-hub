from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.auth import router as auth_router
from app.api.routes.cases import router as cases_router
from app.api.routes.health import router as health_router
from app.api.routes.projects import router as projects_router
from app.api.routes.runs import router as runs_router
from app.api.routes.suites import router as suites_router
from app.api.routes.users import router as users_router
from app.core.config import get_settings
from app.db.session import engine
from app.worker.queue import close_arq_pool


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await close_arq_pool()
    await engine.dispose()


app = FastAPI(title="TestOps Hub", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(projects_router)
app.include_router(runs_router)
app.include_router(suites_router)
app.include_router(cases_router)
