from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.export import ExportRead
from app.schemas.common import ORMModel
from app.schemas.transcript import TranscriptRead


class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    source_type: str = "upload"


class SourceVideoRead(ORMModel):
    id: int
    project_id: int
    original_filename: str
    stored_path: str
    file_url: str
    duration_seconds: float | None
    width: int | None
    height: int | None
    fps: float | None
    created_at: datetime


class ProjectRead(ORMModel):
    id: int
    title: str
    source_type: str
    source_path: str | None
    status: str
    created_at: datetime
    updated_at: datetime
    source_video: SourceVideoRead | None = None
    latest_transcript: TranscriptRead | None = None
    clip_count: int = 0
    pending_clip_count: int = 0
    rejected_clip_count: int = 0
    approved_clip_count: int = 0
    export_count: int = 0
    latest_export: ExportRead | None = None
    next_action: str = "upload_source"


class ProjectDetail(ProjectRead):
    transcript_status: str = "missing"
    clip_generation_status: str = "missing"
