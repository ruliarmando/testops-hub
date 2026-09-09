import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_owned_project
from app.auth.users import current_active_user
from app.db.session import get_db
from app.models.test_case import TestCase
from app.models.user import User
from app.schemas.run import TestCaseCreate, TestCaseRead
from app.services.catalog import get_or_create_suite

router = APIRouter(prefix="/projects/{project_id}/cases", tags=["cases"])


@router.post("", response_model=TestCaseRead, status_code=status.HTTP_201_CREATED)
async def create_case(
    project_id: uuid.UUID,
    body: TestCaseCreate,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
) -> TestCase:
    await get_owned_project(project_id, user, db)
    suite = await get_or_create_suite(db, project_id, body.file_path)

    result = await db.execute(
        select(TestCase).where(
            TestCase.suite_id == suite.id, TestCase.test_title == body.test_title
        )
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="TEST_CASE_ALREADY_EXISTS"
        )

    case = TestCase(suite_id=suite.id, test_title=body.test_title, display_name=body.display_name)
    db.add(case)
    await db.commit()
    await db.refresh(case)
    return case
