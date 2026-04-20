from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import WorkflowJobStatus
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.clip_candidate import ClipCandidate
    from app.models.project import Project


class WorkflowJob(Base, TimestampMixin):
    __tablename__ = "workflow_jobs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    clip_candidate_id: Mapped[int | None] = mapped_column(ForeignKey("clip_candidates.id", ondelete="CASCADE"), nullable=True, index=True)
    job_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), default=WorkflowJobStatus.queued.value, nullable=False, index=True)
    progress: Mapped[int] = mapped_column(default=0, nullable=False)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    payload_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    result_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    project: Mapped["Project"] = relationship(back_populates="workflow_jobs")
    clip_candidate: Mapped["ClipCandidate | None"] = relationship(back_populates="workflow_jobs")
