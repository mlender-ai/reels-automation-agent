from datetime import datetime

from pydantic import BaseModel, Field

from app.core.constants import SubtitlePreset
from app.schemas.common import ORMModel
from app.schemas.export import ExportRead


class ClipCandidateRead(ORMModel):
    id: int
    project_id: int
    start_time: float
    end_time: float
    duration: float
    score: float
    hook_text: str
    suggested_title: str
    suggested_description: str
    suggested_hashtags: str
    subtitle_preset: str
    status: str
    created_at: datetime
    updated_at: datetime
    latest_export: ExportRead | None = None


class ClipCandidateUpdate(BaseModel):
    start_time: float | None = Field(default=None, ge=0)
    end_time: float | None = Field(default=None, ge=0)
    suggested_title: str | None = Field(default=None, min_length=1, max_length=255)
    suggested_description: str | None = Field(default=None, min_length=1)
    suggested_hashtags: str | None = Field(default=None, min_length=1)
    subtitle_preset: SubtitlePreset | None = Field(default=None)
