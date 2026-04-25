from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.constants import ClipStatus, ExportStatus, ProjectStatus
from app.core.logging import get_logger
from app.models.clip_candidate import ClipCandidate
from app.models.export import Export
from app.models.project import Project
from app.models.transcript import Transcript
from app.services.audio_render_service import build_voiceover_copy, render_background_music, render_voiceover_audio
from app.services.ffmpeg_service import export_vertical_clip, extract_thumbnail
from app.services.overlay_render_service import build_story_overlay_assets
from app.services.shorts_story_service import build_story_package_from_clip
from app.services.subtitle_service import build_subtitle_style, build_subtitle_overlay_cues, extract_clip_transcript_segments, write_clip_srt
from app.services.validation_service import validate_clip_metadata, validate_clip_window, validate_generated_subtitle_file
from app.utils.paths import build_export_basename, project_exports_dir, resolve_data_path, to_relative_data_path

logger = get_logger(__name__)


def _next_available_file_path(path: Path) -> Path:
    if not path.exists():
        return path
    stem = path.stem
    suffix = path.suffix
    counter = 2
    while True:
        candidate = path.with_name(f"{stem}-{counter}{suffix}")
        if not candidate.exists():
            return candidate
        counter += 1


def export_clip(
    db: Session,
    clip: ClipCandidate,
    project: Project,
    transcript: Transcript,
    source_path: str,
    source_duration_seconds: float | None = None,
) -> Export:
    if clip.status not in {ClipStatus.approved.value, ClipStatus.exported.value}:
        raise HTTPException(status_code=400, detail="Clip must be approved before export")
    if any(export_record.status == ExportStatus.processing.value for export_record in clip.exports):
        raise HTTPException(status_code=409, detail="An export is already running for this clip")

    exports_dir = project_exports_dir(project.id)
    exports_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    base_name = build_export_basename(clip.id, clip.suggested_title, timestamp)
    output_file = _next_available_file_path(exports_dir / f"{base_name}.mp4")
    thumbnail_file = _next_available_file_path(exports_dir / f"{base_name}.jpg")
    export_record = Export(
        clip_candidate_id=clip.id,
        status=ExportStatus.processing.value,
    )
    db.add(export_record)
    db.commit()
    db.refresh(export_record)
    logger.info(
        "Starting export. project_id=%s clip_id=%s start_time=%s end_time=%s",
        project.id,
        clip.id,
        clip.start_time,
        clip.end_time,
    )

    try:
        clip.duration = validate_clip_window(clip.start_time, clip.end_time, max_source_duration=source_duration_seconds)
        validate_clip_metadata(clip.suggested_title, clip.suggested_description, clip.suggested_hashtags, clip.subtitle_preset)
        subtitle_file, subtitle_relative_path = write_clip_srt(project.id, clip, transcript, base_name=base_name)
        validate_generated_subtitle_file(subtitle_file)
        overlay_assets = []
        narration_file = None
        background_music_file = None
        clip_transcript_segments = extract_clip_transcript_segments(clip, transcript)
        try:
            story_package = build_story_package_from_clip(
                clip,
                transcript_segments=clip_transcript_segments,
                source_runtime_seconds=source_duration_seconds,
            )
            overlay_assets = build_story_overlay_assets(
                project.id,
                clip.id,
                base_name,
                story_package,
                subtitle_cues=build_subtitle_overlay_cues(clip, transcript),
            )
            voiceover_copy = build_voiceover_copy(clip, story_package)
            narration_file = render_voiceover_audio(project.id, clip.id, base_name, voiceover_copy)
            background_music_file = render_background_music(project.id, clip.id, base_name, clip.duration)
        except Exception as exc:  # pragma: no cover - best effort styling fallback
            logger.warning("Story overlay generation skipped. project_id=%s clip_id=%s detail=%s", project.id, clip.id, exc)
        export_vertical_clip(
            input_path=resolve_data_path(source_path),
            output_path=output_file,
            subtitle_path=subtitle_file,
            start_time=clip.start_time,
            duration=clip.duration,
            preset_style=build_subtitle_style(clip.subtitle_preset),
            overlay_assets=overlay_assets,
            burn_in_subtitles=not bool(overlay_assets),
            narration_path=narration_file,
            background_music_path=background_music_file,
        )
        try:
            extract_thumbnail(output_file, thumbnail_file, capture_time=min(1.2, max(0.25, clip.duration / 3)))
            export_record.thumbnail_path = to_relative_data_path(thumbnail_file)
        except HTTPException:
            export_record.thumbnail_path = None
        export_record.output_path = to_relative_data_path(output_file)
        export_record.subtitle_path = subtitle_relative_path
        export_record.status = ExportStatus.completed.value
        clip.status = ClipStatus.exported.value
        project.status = ProjectStatus.exported.value
        db.add_all([export_record, clip, project])
        db.commit()
        db.refresh(export_record)
        logger.info("Export completed. project_id=%s clip_id=%s output_path=%s", project.id, clip.id, export_record.output_path)
        return export_record
    except HTTPException as exc:
        export_record.status = ExportStatus.failed.value
        clip.status = ClipStatus.approved.value
        project.status = ProjectStatus.ready_for_review.value
        db.add_all([export_record, clip, project])
        db.commit()
        for path in [output_file, thumbnail_file]:
            Path(path).unlink(missing_ok=True)
        logger.warning("Export failed. project_id=%s clip_id=%s detail=%s", project.id, clip.id, exc.detail)
        raise HTTPException(status_code=exc.status_code, detail=str(exc.detail)) from exc
    except Exception as exc:
        export_record.status = ExportStatus.failed.value
        clip.status = ClipStatus.approved.value
        project.status = ProjectStatus.ready_for_review.value
        db.add_all([export_record, clip, project])
        db.commit()
        for path in [output_file, thumbnail_file]:
            Path(path).unlink(missing_ok=True)
        logger.exception("Unexpected export failure. project_id=%s clip_id=%s", project.id, clip.id)
        raise HTTPException(status_code=500, detail=f"Export failed: {exc}") from exc
