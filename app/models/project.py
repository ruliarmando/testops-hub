import uuid

import fastapi_users.db  # noqa: F401  (import before fastapi_users_db_sqlalchemy.generics below: fastapi-users 15.x silently drops its SQLAlchemy re-exports if that submodule is imported first)
from fastapi_users_db_sqlalchemy.generics import GUID
from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Project(Base):
    __tablename__ = "project"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(length=200))
    owner_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("user.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str | None] = mapped_column(String(length=64), nullable=True)
    token_last4: Mapped[str | None] = mapped_column(String(length=4), nullable=True)
