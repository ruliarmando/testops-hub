import enum
import uuid

import fastapi_users.db  # noqa: F401  (import before fastapi_users_db_sqlalchemy.generics below: fastapi-users 15.x silently drops its SQLAlchemy re-exports if that submodule is imported first)
from fastapi_users_db_sqlalchemy.generics import GUID
from sqlalchemy import Enum, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TestStatus(str, enum.Enum):
    PASSED = "passed"
    FAILED = "failed"
    SKIPPED = "skipped"


class TestResult(Base):
    __tablename__ = "test_result"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    run_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("test_run.id", ondelete="CASCADE"), index=True
    )
    case_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("test_case.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[TestStatus] = mapped_column(Enum(TestStatus, name="test_status"))
    duration_ms: Mapped[int] = mapped_column(Integer)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
