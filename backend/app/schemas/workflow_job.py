from datetime import datetime
from typing import Any

from app.schemas.common import ORMModel


class WorkflowJobRead(ORMModel):
    id: int
    project_id: int
    clip_candidate_id: int | None = None
    job_type: str
    status: str
    progress: int
    message: str | None = None
    error_detail: str | None = None
    payload_json: dict[str, Any] | None = None
    result_json: dict[str, Any] | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    project_title: str | None = None
    clip_title: str | None = None
