from pydantic import BaseModel

from app.schemas.clip import ClipCandidateRead
from app.schemas.export import ExportRead
from app.schemas.project import ProjectRead


class DashboardSummaryRead(BaseModel):
    total_projects: int
    pending_review_count: int
    approved_count: int
    export_count: int
    recent_projects: list[ProjectRead]
    recent_exports: list[ExportRead]
    pending_review_clips: list[ClipCandidateRead]
