from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class QueuePublishRequest(BaseModel):
    platform: str = Field(pattern="^(youtube|instagram|tiktok)$")


class PublishJobRead(ORMModel):
    id: int
    clip_candidate_id: int
    platform: str
    adapter_name: str
    status: str
    payload_json: dict | None
    result_json: dict | None
    created_at: datetime
    updated_at: datetime
    clip_title: str | None = None
    project_id: int | None = None


class PlatformStatusRead(BaseModel):
    platform: str
    adapter_name: str
    status: str
    account_label: str


class PublishQueueResponse(BaseModel):
    items: list[PublishJobRead]
    platforms: list[PlatformStatusRead]

