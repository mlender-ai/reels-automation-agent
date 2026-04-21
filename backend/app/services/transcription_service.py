import json
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.constants import ProjectStatus
from app.core.logging import get_logger
from app.models.project import Project
from app.models.source_video import SourceVideo
from app.models.transcript import Transcript
from app.services.ffmpeg_service import probe_video
from app.utils.paths import project_transcripts_dir, resolve_data_path, to_relative_data_path

try:
    from faster_whisper import WhisperModel
except ImportError:  # pragma: no cover - dependency validation happens at runtime
    WhisperModel = None

logger = get_logger(__name__)


def _humanize_transcription_error(exc: Exception) -> tuple[int, str]:
    raw = " ".join(part for part in [str(exc), getattr(exc, "stderr", ""), getattr(exc, "stdout", "")] if part).lower()
    if "moov atom not found" in raw or "invalid data found" in raw or "error opening input" in raw:
        return (
            400,
            "Transcription failed because the uploaded video looks unsupported or corrupted. Re-export the source locally and try again.",
        )
    if "cuda" in raw or "cublas" in raw or "device" in raw:
        return (
            500,
            "Transcription could not start on the configured Whisper device. Switch to CPU or fix the local GPU setup, then retry.",
        )
    if "ffmpeg" in raw:
        return (
            500,
            "Transcription failed while decoding the local video's audio track. Confirm FFmpeg is installed and the source has readable audio.",
        )
    return (
        500,
        "Transcription failed. Check the source video's audio track and your faster-whisper setup, then try again.",
    )


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
    try:
        model = _get_whisper_model()
        source_path = resolve_data_path(source_video.stored_path)
        if not source_path.exists():
            raise HTTPException(status_code=404, detail="Source video file is missing on disk")
        if Path(source_path).stat().st_size <= 0:
            raise HTTPException(status_code=400, detail="Source video file is empty. Upload a valid local video before transcription.")
        metadata = probe_video(source_path)
        if not metadata.get("duration_seconds") or float(metadata["duration_seconds"] or 0) <= 0:
            raise HTTPException(
                status_code=400,
                detail="Source video could not be decoded for transcription. Re-export the file locally and try again.",
            )
        logger.info(
            "Starting transcription. project_id=%s source_path=%s model=%s device=%s",
            project.id,
            source_path,
            settings.whisper_model_size,
            settings.whisper_device,
        )
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
        logger.info(
            "Transcription completed. project_id=%s language=%s segments=%s",
            project.id,
            getattr(info, "language", None),
            len(normalized_segments),
        )
        return transcript
    except HTTPException as exc:
        project.status = ProjectStatus.failed.value
        db.add(project)
        db.commit()
        logger.warning("Transcription request failed. project_id=%s detail=%s", project.id, exc.detail)
        raise
    except Exception as exc:
        project.status = ProjectStatus.failed.value
        db.add(project)
        db.commit()
        status_code, detail = _humanize_transcription_error(exc)
        logger.exception("Unhandled transcription failure. project_id=%s", project.id)
        raise HTTPException(status_code=status_code, detail=detail) from exc
