import uuid

import fastapi_users.db  # noqa: F401  (import before fastapi_users_db_sqlalchemy.generics below: fastapi-users 15.x silently drops its SQLAlchemy re-exports if that submodule is imported first)
from fastapi_users_db_sqlalchemy.generics import GUID
from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TestCase(Base):
    __tablename__ = "test_case"
    __table_args__ = (UniqueConstraint("suite_id", "test_title"),)

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    suite_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("test_suite.id", ondelete="CASCADE"), index=True
    )
    test_title: Mapped[str] = mapped_column(String(length=500))
    display_name: Mapped[str | None] = mapped_column(String(length=500), nullable=True)
