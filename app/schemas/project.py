import uuid

from pydantic import BaseModel, ConfigDict


class ProjectCreate(BaseModel):
    name: str


class ProjectUpdate(BaseModel):
    name: str


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    owner_id: uuid.UUID


class ProjectTokenCreate(BaseModel):
    token: str


class ProjectTokenRead(BaseModel):
    masked_token: str
