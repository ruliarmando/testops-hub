import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_owned_project
from app.auth.users import current_active_user
from app.db.session import get_db
from app.models.test_case import TestCase
from app.models.test_suite import TestSuite
from app.models.user import User
from app.schemas.run import TestCaseRead, TestCaseUpdate, TestSuiteRead

router = APIRouter(prefix="/projects/{project_id}/suites", tags=["suites"])


@router.get("", response_model=list[TestSuiteRead])
async def list_suites(
    project_id: uuid.UUID,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
) -> list[TestSuite]:
    await get_owned_project(project_id, user, db)
    result = await db.execute(select(TestSuite).where(TestSuite.project_id == project_id))
    return list(result.scalars().all())


@router.get("/{suite_id}/cases", response_model=list[TestCaseRead])
async def list_cases(
    project_id: uuid.UUID,
    suite_id: uuid.UUID,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
) -> list[TestCase]:
    await get_owned_project(project_id, user, db)
    suite = await db.get(TestSuite, suite_id)
    if suite is None or suite.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="TEST_SUITE_NOT_FOUND")

    result = await db.execute(select(TestCase).where(TestCase.suite_id == suite_id))
    return list(result.scalars().all())


@router.patch("/{suite_id}/cases/{case_id}", response_model=TestCaseRead)
async def update_case(
    project_id: uuid.UUID,
    suite_id: uuid.UUID,
    case_id: uuid.UUID,
    body: TestCaseUpdate,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
) -> TestCase:
    await get_owned_project(project_id, user, db)
    suite = await db.get(TestSuite, suite_id)
    if suite is None or suite.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="TEST_SUITE_NOT_FOUND")

    case = await db.get(TestCase, case_id)
    if case is None or case.suite_id != suite_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="TEST_CASE_NOT_FOUND")

    case.display_name = body.display_name
    await db.commit()
    await db.refresh(case)
    return case
