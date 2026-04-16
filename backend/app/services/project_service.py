import os
import shutil
from pathlib import Path

from fastapi import HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.constants import ClipStatus, ExportStatus, ProjectStatus
from app.models.clip_candidate import ClipCandidate
from app.models.export import Export
from app.models.project import Project
from app.models.source_video import SourceVideo
from app.models.transcript import Transcript
from app.services.ffmpeg_service import probe_video
from app.services.serializers import serialize_clip, serialize_export, serialize_project
from app.services.validation_service import validate_video_upload
from app.utils.paths import (
    build_upload_target,
    ensure_project_directories,
    project_clips_dir,
    project_exports_dir,
    project_transcripts_dir,
    resolve_data_path,
    to_relative_data_path,
)


def get_project_or_404(db: Session, project_id: int) -> Project:
    statement = (
        select(Project)
        .where(Project.id == project_id)
        .options(
            selectinload(Project.source_videos),
            selectinload(Project.transcripts),
            selectinload(Project.clip_candidates).selectinload(ClipCandidate.exports),
        )
    )
    project = db.scalar(statement)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def create_project(db: Session, title: str, source_type: str = "upload") -> Project:
    project = Project(title=title, source_type=source_type, status=ProjectStatus.draft.value)
    db.add(project)
    db.commit()
    db.refresh(project)
    ensure_project_directories(project.id)
    return get_project_or_404(db, project.id)


def list_projects(db: Session) -> list[Project]:
    statement = (
        select(Project)
        .options(
            selectinload(Project.source_videos),
            selectinload(Project.transcripts),
            selectinload(Project.clip_candidates).selectinload(ClipCandidate.exports),
        )
        .order_by(Project.created_at.desc())
    )
    return db.scalars(statement).unique().all()


def _clear_directory_contents(path: Path) -> None:
    if not path.exists():
        return
    for item in path.iterdir():
        if item.is_dir():
            shutil.rmtree(item, ignore_errors=True)
        else:
            item.unlink(missing_ok=True)


def reset_project_outputs(db: Session, project: Project) -> None:
    for transcript in list(project.transcripts):
        db.delete(transcript)
    for clip in list(project.clip_candidates):
        db.delete(clip)
    db.flush()
    _clear_directory_contents(project_transcripts_dir(project.id))
    _clear_directory_contents(project_clips_dir(project.id))
    _clear_directory_contents(project_exports_dir(project.id))


def save_source_upload(db: Session, project: Project, upload_file: UploadFile) -> Project:
    if not upload_file.filename:
        raise HTTPException(status_code=400, detail="Upload is missing a filename")

    upload_file.file.seek(0, os.SEEK_END)
    upload_size = upload_file.file.tell()
    upload_file.file.seek(0)
    validate_video_upload(upload_file.filename, upload_file.content_type, upload_size)

    ensure_project_directories(project.id)
    target = build_upload_target(project.id, upload_file.filename)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)
    upload_file.file.close()

    try:
        metadata = probe_video(target)
    except HTTPException as exc:
        target.unlink(missing_ok=True)
        raise HTTPException(
            status_code=400,
            detail="Uploaded file could not be parsed as a supported video. Try another local video file.",
        ) from exc

    relative_path = to_relative_data_path(target)
    existing_video = project.source_videos[0] if project.source_videos else None
    previous_video_path = existing_video.stored_path if existing_video else None
    reset_project_outputs(db, project)
    if existing_video:
        existing_video.original_filename = upload_file.filename
        existing_video.stored_path = relative_path
        existing_video.duration_seconds = metadata["duration_seconds"]
        existing_video.width = metadata["width"]
        existing_video.height = metadata["height"]
        existing_video.fps = metadata["fps"]
    else:
        existing_video = SourceVideo(
            project_id=project.id,
            original_filename=upload_file.filename,
            stored_path=relative_path,
            duration_seconds=metadata["duration_seconds"],
            width=metadata["width"],
            height=metadata["height"],
            fps=metadata["fps"],
        )
        db.add(existing_video)

    project.source_path = relative_path
    project.status = ProjectStatus.uploaded.value
    db.add(project)
    db.commit()
    if previous_video_path and previous_video_path != relative_path:
        resolve_data_path(previous_video_path).unlink(missing_ok=True)
    return get_project_or_404(db, project.id)


def latest_transcript(project: Project) -> Transcript | None:
    return project.transcripts[0] if project.transcripts else None


def latest_source_video(project: Project) -> SourceVideo | None:
    return project.source_videos[0] if project.source_videos else None


def list_project_clips(db: Session, project_id: int) -> list[ClipCandidate]:
    statement = (
        select(ClipCandidate)
        .where(ClipCandidate.project_id == project_id)
        .options(selectinload(ClipCandidate.exports))
        .order_by(ClipCandidate.score.desc(), ClipCandidate.created_at.asc())
    )
    return db.scalars(statement).unique().all()


def get_dashboard_summary(db: Session) -> dict:
    recent_projects = list_projects(db)[:5]
    recent_exports = (
        db.scalars(
            select(Export)
            .options(selectinload(Export.clip_candidate).selectinload(ClipCandidate.project))
            .order_by(Export.created_at.desc())
            .limit(6)
        )
        .unique()
        .all()
    )
    pending_review_clips = (
        db.scalars(
            select(ClipCandidate)
            .options(selectinload(ClipCandidate.exports))
            .where(ClipCandidate.status == ClipStatus.pending.value)
            .order_by(ClipCandidate.score.desc(), ClipCandidate.created_at.desc())
            .limit(6)
        )
        .unique()
        .all()
    )
    total_projects = db.scalar(select(func.count(Project.id))) or 0
    pending_review_count = db.scalar(select(func.count(ClipCandidate.id)).where(ClipCandidate.status == ClipStatus.pending.value)) or 0
    approved_count = (
        db.scalar(select(func.count(ClipCandidate.id)).where(ClipCandidate.status.in_([ClipStatus.approved.value, ClipStatus.exported.value])))
        or 0
    )
    export_count = db.scalar(select(func.count(Export.id)).where(Export.status == ExportStatus.completed.value)) or 0

    return {
        "total_projects": total_projects,
        "pending_review_count": pending_review_count,
        "approved_count": approved_count,
        "export_count": export_count,
        "recent_projects": [serialize_project(project) for project in recent_projects],
        "recent_exports": [serialize_export(export) for export in recent_exports],
        "pending_review_clips": [serialize_clip(clip) for clip in pending_review_clips],
    }
