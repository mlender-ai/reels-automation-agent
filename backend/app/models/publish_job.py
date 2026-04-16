from typing import TYPE_CHECKING, Any

from sqlalchemy import ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import PublishStatus
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.clip_candidate import ClipCandidate


class PublishJob(Base, TimestampMixin):
    __tablename__ = "publish_jobs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    clip_candidate_id: Mapped[int] = mapped_column(ForeignKey("clip_candidates.id", ondelete="CASCADE"), nullable=False, index=True)
    platform: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    adapter_name: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default=PublishStatus.queued.value, nullable=False, index=True)
    payload_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    result_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    clip_candidate: Mapped["ClipCandidate"] = relationship(back_populates="publish_jobs")

