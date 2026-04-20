from typing import TYPE_CHECKING

from sqlalchemy import Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import ClipStatus, SubtitlePreset
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.export import Export
    from app.models.project import Project
    from app.models.publish_job import PublishJob
    from app.models.workflow_job import WorkflowJob


class ClipCandidate(Base, TimestampMixin):
    __tablename__ = "clip_candidates"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    start_time: Mapped[float] = mapped_column(Float, nullable=False)
    end_time: Mapped[float] = mapped_column(Float, nullable=False)
    duration: Mapped[float] = mapped_column(Float, nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False, index=True)
    hook_text: Mapped[str] = mapped_column(Text, nullable=False)
    suggested_title: Mapped[str] = mapped_column(String(255), nullable=False)
    suggested_description: Mapped[str] = mapped_column(Text, nullable=False)
    suggested_hashtags: Mapped[str] = mapped_column(Text, nullable=False)
    subtitle_preset: Mapped[str] = mapped_column(String(50), default=SubtitlePreset.clean.value, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default=ClipStatus.pending.value, nullable=False, index=True)

    project: Mapped["Project"] = relationship(back_populates="clip_candidates")
    exports: Mapped[list["Export"]] = relationship(
        back_populates="clip_candidate",
        cascade="all, delete-orphan",
        order_by="Export.created_at.desc()",
    )
    publish_jobs: Mapped[list["PublishJob"]] = relationship(
        back_populates="clip_candidate",
        cascade="all, delete-orphan",
        order_by="PublishJob.created_at.desc()",
    )
    workflow_jobs: Mapped[list["WorkflowJob"]] = relationship(
        back_populates="clip_candidate",
        cascade="all, delete-orphan",
        order_by="WorkflowJob.created_at.desc()",
    )
