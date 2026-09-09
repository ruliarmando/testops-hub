import datetime
import uuid

import fastapi_users.db  # noqa: F401  (import before fastapi_users_db_sqlalchemy.generics below: fastapi-users 15.x silently drops its SQLAlchemy re-exports if that submodule is imported first)
from fastapi_users_db_sqlalchemy.generics import GUID
from sqlalchemy import JSON, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TestRun(Base):
    __tablename__ = "test_run"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("project.id", ondelete="CASCADE"), index=True
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.UTC)
    )
    run_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)
