from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import ORMModel


class TranscriptSegmentRead(BaseModel):
    id: int
    start: float
    end: float
    text: str


class TranscriptRead(ORMModel):
    id: int
    project_id: int
    language: str | None
    model_name: str
    raw_json_path: str
    raw_json_url: str
    text: str
    created_at: datetime
    segments: list[TranscriptSegmentRead] = []

