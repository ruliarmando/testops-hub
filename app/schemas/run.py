import datetime
import enum
import uuid
from typing import Any

from pydantic import BaseModel, ConfigDict


class TestStatus(str, enum.Enum):
    PASSED = "passed"
    FAILED = "failed"
    SKIPPED = "skipped"


class TestResultIn(BaseModel):
    file_path: str
    test_title: str
    status: TestStatus
    duration_ms: int
    error_message: str | None = None


class TestRunCreate(BaseModel):
    results: list[TestResultIn]
    run_metadata: dict[str, Any] | None = None


class TestResultRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    case_id: uuid.UUID
    file_path: str
    test_title: str
    status: TestStatus
    duration_ms: int
    error_message: str | None


class TestRunSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    created_at: datetime.datetime
    run_metadata: dict[str, Any] | None
    pass_rate: float | None


class TestRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    created_at: datetime.datetime
    run_metadata: dict[str, Any] | None
    results: list[TestResultRead]
    pass_rate: float | None


class TestSuiteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    file_path: str


class TestCaseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    suite_id: uuid.UUID
    test_title: str
