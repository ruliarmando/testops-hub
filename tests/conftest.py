import os
from pathlib import Path

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/testops_hub_test",
)

import pytest
from alembic.config import Config
from httpx import ASGITransport, AsyncClient

from alembic import command
from app.main import app

REPO_ROOT = Path(__file__).resolve().parent.parent


@pytest.fixture(scope="session", autouse=True)
def apply_migrations() -> None:
    config = Config(str(REPO_ROOT / "alembic.ini"))
    command.upgrade(config, "head")


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
