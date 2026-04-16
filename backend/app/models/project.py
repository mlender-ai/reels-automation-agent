from typing import TYPE_CHECKING

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import ProjectStatus
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.clip_candidate import ClipCandidate
    from app.models.source_video import SourceVideo
    from app.models.transcript import Transcript


class Project(TimestampMixin, Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    source_type: Mapped[str] = mapped_column(String(50), default="upload", nullable=False)
    source_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default=ProjectStatus.draft.value, nullable=False, index=True)

    source_videos: Mapped[list["SourceVideo"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="SourceVideo.created_at.desc()",
    )
    transcripts: Mapped[list["Transcript"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="Transcript.created_at.desc()",
    )
    clip_candidates: Mapped[list["ClipCandidate"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="ClipCandidate.score.desc()",
    )

