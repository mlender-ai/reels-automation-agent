import json
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.constants import ProjectStatus
from app.models.project import Project
from app.models.source_video import SourceVideo
from app.models.transcript import Transcript
from app.utils.paths import project_transcripts_dir, resolve_data_path, to_relative_data_path

try:
    from faster_whisper import WhisperModel
except ImportError:  # pragma: no cover - dependency validation happens at runtime
    WhisperModel = None


def _get_whisper_model() -> "WhisperModel":
    if WhisperModel is None:
        raise HTTPException(
            status_code=500,
            detail="faster-whisper is not installed. Install backend requirements first.",
        )
    return WhisperModel(
        settings.whisper_model_size,
        device=settings.whisper_device,
        compute_type=settings.whisper_compute_type,
        download_root=str(settings.whisper_download_root),
    )


def load_transcript_payload(raw_json_path: str) -> dict:
    transcript_path = resolve_data_path(raw_json_path)
    if not transcript_path.exists():
        raise HTTPException(status_code=404, detail="Transcript JSON file is missing")
    try:
        return json.loads(transcript_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail="Transcript JSON is corrupted") from exc


def load_transcript_segments(transcript: Transcript) -> list[dict]:
    return load_transcript_payload(transcript.raw_json_path).get("segments", [])


def transcribe_project(db: Session, project: Project, source_video: SourceVideo) -> Transcript:
    model = _get_whisper_model()
    source_path = resolve_data_path(source_video.stored_path)
    if not source_path.exists():
        raise HTTPException(status_code=404, detail="Source video file is missing on disk")
    segments_iter, info = model.transcribe(
        str(source_path),
        vad_filter=True,
        beam_size=5,
        word_timestamps=False,
    )

    normalized_segments: list[dict] = []
    transcript_parts: list[str] = []
    for idx, segment in enumerate(segments_iter):
        text = " ".join(segment.text.split())
        if not text:
            continue
        normalized_segments.append(
            {
                "id": idx,
                "start": round(float(segment.start), 3),
                "end": round(float(segment.end), 3),
                "text": text,
            }
        )
        transcript_parts.append(text)

    if not normalized_segments:
        raise HTTPException(status_code=422, detail="No spoken segments were detected in the source video")

    transcript_payload = {
        "project_id": project.id,
        "language": getattr(info, "language", None),
        "duration_seconds": source_video.duration_seconds,
        "segment_count": len(normalized_segments),
        "segments": normalized_segments,
    }
    transcripts_dir = project_transcripts_dir(project.id)
    transcripts_dir.mkdir(parents=True, exist_ok=True)
    transcript_path = transcripts_dir / "transcript_latest.json"
    transcript_path.write_text(json.dumps(transcript_payload, ensure_ascii=False, indent=2), encoding="utf-8")

    transcript = db.scalar(select(Transcript).where(Transcript.project_id == project.id).order_by(Transcript.created_at.desc()))
    transcript_text = " ".join(transcript_parts)
    relative_path = to_relative_data_path(transcript_path)
    if transcript:
        transcript.language = getattr(info, "language", None)
        transcript.model_name = settings.whisper_model_size
        transcript.raw_json_path = relative_path
        transcript.text = transcript_text
    else:
        transcript = Transcript(
            project_id=project.id,
            language=getattr(info, "language", None),
            model_name=settings.whisper_model_size,
            raw_json_path=relative_path,
            text=transcript_text,
        )
        db.add(transcript)

    project.status = ProjectStatus.transcribed.value
    db.add(project)
    db.commit()
    db.refresh(transcript)
    return transcript
