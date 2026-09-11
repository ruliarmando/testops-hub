import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_owned_project
from app.auth.project_token import generate_project_token, hash_project_token
from app.auth.users import current_active_user
from app.db.session import get_db
from app.models.project import Project
from app.models.user import User
from app.schemas.project import (
    ProjectCreate,
    ProjectRead,
    ProjectTokenCreate,
    ProjectTokenRead,
    ProjectUpdate,
)

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(
    body: ProjectCreate,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Project:
    project = Project(name=body.name, owner_id=user.id)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("", response_model=list[ProjectRead])
async def list_projects(
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
) -> list[Project]:
    result = await db.execute(select(Project).where(Project.owner_id == user.id))
    return list(result.scalars().all())


@router.get("/{project_id}", response_model=ProjectRead)
async def read_project(
    project_id: uuid.UUID,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Project:
    return await get_owned_project(project_id, user, db)


@router.patch("/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: uuid.UUID,
    body: ProjectUpdate,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Project:
    project = await get_owned_project(project_id, user, db)
    project.name = body.name
    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: uuid.UUID,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    project = await get_owned_project(project_id, user, db)
    await db.delete(project)
    await db.commit()


@router.post("/{project_id}/token", response_model=ProjectTokenCreate)
async def create_project_token(
    project_id: uuid.UUID,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectTokenCreate:
    project = await get_owned_project(project_id, user, db)
    raw_token = generate_project_token()
    project.token_hash = hash_project_token(raw_token)
    project.token_last4 = raw_token[-4:]
    await db.commit()
    return ProjectTokenCreate(token=raw_token)


@router.get("/{project_id}/token", response_model=ProjectTokenRead)
async def read_project_token(
    project_id: uuid.UUID,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectTokenRead:
    project = await get_owned_project(project_id, user, db)
    if project.token_last4 is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="PROJECT_TOKEN_NOT_FOUND"
        )
    return ProjectTokenRead(masked_token=f"****{project.token_last4}")
