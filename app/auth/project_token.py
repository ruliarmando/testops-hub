import hashlib
import hmac
import secrets
import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.project import Project

_bearer_scheme = HTTPBearer(auto_error=False)


def generate_project_token() -> str:
    return f"tth_{secrets.token_urlsafe(32)}"


def hash_project_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def get_project_from_token(
    project_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> Project:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="MISSING_PROJECT_TOKEN"
        )

    project = await db.get(Project, project_id)
    if project is None or project.token_hash is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="INVALID_PROJECT_TOKEN"
        )

    provided_hash = hash_project_token(credentials.credentials)
    if not hmac.compare_digest(provided_hash, project.token_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="INVALID_PROJECT_TOKEN"
        )

    return project
