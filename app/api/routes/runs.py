import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import case as sql_case
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_owned_project
from app.auth.project_token import get_project_from_token
from app.auth.users import current_active_user
from app.db.session import get_db
from app.models.project import Project
from app.models.test_case import TestCase
from app.models.test_result import TestResult
from app.models.test_result import TestStatus as ModelTestStatus
from app.models.test_run import TestRun
from app.models.test_suite import TestSuite
from app.models.user import User
from app.schemas.run import (
    TestResultIn,
    TestResultRead,
    TestRunCreate,
    TestRunRead,
    TestRunSummary,
    TestStatus,
)
from app.worker.queue import get_arq_pool

router = APIRouter(prefix="/projects/{project_id}/runs", tags=["runs"])


def _to_result_read(result: TestResult, test_title: str, file_path: str) -> TestResultRead:
    return TestResultRead(
        id=result.id,
        case_id=result.case_id,
        file_path=file_path,
        test_title=test_title,
        status=result.status,
        duration_ms=result.duration_ms,
        error_message=result.error_message,
    )


def _compute_pass_rate(results: list[TestResultRead]) -> float | None:
    if not results:
        return None
    passed = sum(1 for result in results if result.status == TestStatus.PASSED)
    return round(passed / len(results) * 100, 2)


async def _build_result_reads(db: AsyncSession, run_id: uuid.UUID) -> list[TestResultRead]:
    result = await db.execute(
        select(TestResult, TestCase.test_title, TestSuite.file_path)
        .join(TestCase, TestResult.case_id == TestCase.id)
        .join(TestSuite, TestCase.suite_id == TestSuite.id)
        .where(TestResult.run_id == run_id)
    )
    return [
        _to_result_read(test_result, test_title, file_path)
        for test_result, test_title, file_path in result.all()
    ]


async def _pass_rates_by_run(
    db: AsyncSession, run_ids: list[uuid.UUID]
) -> dict[uuid.UUID, float | None]:
    if not run_ids:
        return {}

    result = await db.execute(
        select(
            TestResult.run_id,
            func.count(TestResult.id),
            func.sum(sql_case((TestResult.status == ModelTestStatus.PASSED, 1), else_=0)),
        )
        .where(TestResult.run_id.in_(run_ids))
        .group_by(TestResult.run_id)
    )
    return {
        run_id: round(passed / total * 100, 2) if total else None
        for run_id, total, passed in result.all()
    }


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
    created: list[tuple[TestResultIn, TestResult]] = []

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
        created.append((item, result))

    await db.flush()

    result_reads = [
        _to_result_read(result, item.test_title, item.file_path) for item, result in created
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
        pass_rate=_compute_pass_rate(result_reads),
    )


@router.get("", response_model=list[TestRunSummary])
async def list_runs(
    project_id: uuid.UUID,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
) -> list[TestRunSummary]:
    await get_owned_project(project_id, user, db)
    result = await db.execute(
        select(TestRun)
        .where(TestRun.project_id == project_id)
        .order_by(TestRun.created_at.desc())
    )
    runs = list(result.scalars().all())

    pass_rates = await _pass_rates_by_run(db, [run.id for run in runs])
    return [
        TestRunSummary(
            id=run.id,
            project_id=run.project_id,
            created_at=run.created_at,
            run_metadata=run.run_metadata,
            pass_rate=pass_rates.get(run.id),
        )
        for run in runs
    ]


@router.get("/{run_id}", response_model=TestRunRead)
async def read_run(
    project_id: uuid.UUID,
    run_id: uuid.UUID,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
) -> TestRunRead:
    await get_owned_project(project_id, user, db)
    run = await db.get(TestRun, run_id)
    if run is None or run.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="TEST_RUN_NOT_FOUND")

    result_reads = await _build_result_reads(db, run.id)
    return TestRunRead(
        id=run.id,
        project_id=run.project_id,
        created_at=run.created_at,
        run_metadata=run.run_metadata,
        results=result_reads,
        pass_rate=_compute_pass_rate(result_reads),
    )
