import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.test_case import TestCase
from app.models.test_suite import TestSuite


async def get_or_create_suite(
    db: AsyncSession,
    project_id: uuid.UUID,
    file_path: str,
    cache: dict[str, TestSuite] | None = None,
) -> TestSuite:
    if cache is not None and file_path in cache:
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

    if cache is not None:
        cache[file_path] = suite
    return suite


async def get_or_create_case(
    db: AsyncSession,
    suite_id: uuid.UUID,
    test_title: str,
    cache: dict[tuple[uuid.UUID, str], TestCase] | None = None,
) -> TestCase:
    key = (suite_id, test_title)
    if cache is not None and key in cache:
        return cache[key]

    result = await db.execute(
        select(TestCase).where(TestCase.suite_id == suite_id, TestCase.test_title == test_title)
    )
    case = result.scalar_one_or_none()
    if case is None:
        case = TestCase(suite_id=suite_id, test_title=test_title)
        db.add(case)
        await db.flush()

    if cache is not None:
        cache[key] = case
    return case
