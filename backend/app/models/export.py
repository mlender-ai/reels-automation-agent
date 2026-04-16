from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import ExportStatus
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.clip_candidate import ClipCandidate


class Export(Base, TimestampMixin):
    __tablename__ = "exports"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    clip_candidate_id: Mapped[int] = mapped_column(ForeignKey("clip_candidates.id", ondelete="CASCADE"), nullable=False, index=True)
    output_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    subtitle_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    thumbnail_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default=ExportStatus.processing.value, nullable=False, index=True)

    clip_candidate: Mapped["ClipCandidate"] = relationship(back_populates="exports")

