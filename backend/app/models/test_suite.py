import uuid

import fastapi_users.db  # noqa: F401  (import before fastapi_users_db_sqlalchemy.generics below: fastapi-users 15.x silently drops its SQLAlchemy re-exports if that submodule is imported first)
from fastapi_users_db_sqlalchemy.generics import GUID
from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TestSuite(Base):
    __tablename__ = "test_suite"
    __table_args__ = (UniqueConstraint("project_id", "file_path"),)

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("project.id", ondelete="CASCADE"), index=True
    )
    file_path: Mapped[str] = mapped_column(String(length=500))
