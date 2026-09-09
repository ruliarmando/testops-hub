import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.project_token import get_project_from_token
from app.db.session import get_db
from app.models.project import Project
from app.models.test_case import TestCase
from app.models.test_result import TestResult
from app.models.test_run import TestRun
from app.models.test_suite import TestSuite
from app.schemas.run import TestResultIn, TestResultRead, TestRunCreate, TestRunRead
from app.worker.queue import get_arq_pool

router = APIRouter(prefix="/projects/{project_id}/runs", tags=["runs"])


async def _get_or_create_suite(
    db: AsyncSession, project_id: uuid.UUID, file_path: str, cache: dict[str, TestSuite]
) -> TestSuite:
    if file_path in cache:
        return cache[file_path]

    result = await db.execute(
        select(TestSuite).where(
            TestSuite.project_id == project_id, TestSuite.file_path == file_path
        )
    )
    suite = result.scalar_one_or_none()
    if suite is None:
        suite = TestSuite(project_id=project_id, file_path=file_path)
        db.add(suite)
        await db.flush()

    cache[file_path] = suite
    return suite


async def _get_or_create_case(
    db: AsyncSession,
    suite_id: uuid.UUID,
    test_title: str,
    cache: dict[tuple[uuid.UUID, str], TestCase],
) -> TestCase:
    key = (suite_id, test_title)
    if key in cache:
        return cache[key]

    result = await db.execute(
        select(TestCase).where(TestCase.suite_id == suite_id, TestCase.test_title == test_title)
    )
    case = result.scalar_one_or_none()
    if case is None:
        case = TestCase(suite_id=suite_id, test_title=test_title)
        db.add(case)
        await db.flush()

    cache[key] = case
    return case


@router.post("", response_model=TestRunRead, status_code=status.HTTP_201_CREATED)
async def ingest_run(
    body: TestRunCreate,
    project: Project = Depends(get_project_from_token),
    db: AsyncSession = Depends(get_db),
) -> TestRunRead:
    run = TestRun(project_id=project.id, run_metadata=body.run_metadata)
    db.add(run)
    await db.flush()

    suite_cache: dict[str, TestSuite] = {}
    case_cache: dict[tuple[uuid.UUID, str], TestCase] = {}
    created: list[tuple[TestResultIn, TestCase, TestResult]] = []

    for item in body.results:
        suite = await _get_or_create_suite(db, project.id, item.file_path, suite_cache)
        case = await _get_or_create_case(db, suite.id, item.test_title, case_cache)
        result = TestResult(
            run_id=run.id,
            case_id=case.id,
            status=item.status,
            duration_ms=item.duration_ms,
            error_message=item.error_message,
        )
        db.add(result)
        created.append((item, case, result))

    await db.flush()

    result_reads = [
        TestResultRead(
            id=result.id,
            case_id=case.id,
            file_path=item.file_path,
            test_title=item.test_title,
            status=result.status,
            duration_ms=result.duration_ms,
            error_message=result.error_message,
        )
        for item, case, result in created
    ]

    await db.commit()

    pool = await get_arq_pool()
    await pool.enqueue_job("process_test_run", str(run.id))

    return TestRunRead(
        id=run.id,
        project_id=run.project_id,
        created_at=run.created_at,
        run_metadata=run.run_metadata,
        results=result_reads,
    )
