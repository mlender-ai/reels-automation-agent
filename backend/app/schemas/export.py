from datetime import datetime

from app.schemas.common import ORMModel


class ExportRead(ORMModel):
    id: int
    clip_candidate_id: int
    output_path: str | None
    output_url: str | None = None
    subtitle_path: str | None
    subtitle_url: str | None = None
    thumbnail_path: str | None
    thumbnail_url: str | None = None
    status: str
    created_at: datetime
    updated_at: datetime
    clip_title: str | None = None
    project_id: int | None = None

