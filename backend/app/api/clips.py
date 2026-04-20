from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.constants import ClipStatus, WorkflowJobType
from app.db.session import get_db
from app.models.clip_candidate import ClipCandidate
from app.models.export import Export
from app.models.project import Project
from app.models.publish_job import PublishJob
from app.schemas.clip import ClipCandidateRead, ClipCandidateUpdate
from app.schemas.export import ExportRead
from app.schemas.publish import PublishJobRead, QueuePublishRequest
from app.schemas.workflow_job import WorkflowJobRead
from app.services.clip_workflow_service import transition_clip_status
from app.services.export_service import export_clip
from app.services.project_service import get_project_or_404, latest_source_video, latest_transcript
from app.services.publish_service import create_publish_job
from app.services.serializers import serialize_clip, serialize_export, serialize_publish_job, serialize_workflow_job
from app.services.validation_service import validate_clip_window
from app.services.workflow_job_service import create_workflow_job, list_clip_jobs
from app.workers.workflow_worker import run_export_job, run_publish_job
from app.workers.publish_worker import simulate_publish_job


router = APIRouter(tags=["clips"])


def get_clip_or_404(db: Session, clip_id: int) -> ClipCandidate:
    statement = (
        select(ClipCandidate)
        .where(ClipCandidate.id == clip_id)
        .options(
            selectinload(ClipCandidate.exports),
            selectinload(ClipCandidate.project).selectinload(Project.source_videos),
            selectinload(ClipCandidate.project).selectinload(Project.transcripts),
            selectinload(ClipCandidate.publish_jobs),
        )
    )
    clip = db.scalar(statement)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip candidate not found")
    return clip


@router.get("/clips/{clip_id}", response_model=ClipCandidateRead)
def get_clip_endpoint(clip_id: int, db: Session = Depends(get_db)) -> dict:
    clip = get_clip_or_404(db, clip_id)
    return serialize_clip(clip)


@router.get("/clips", response_model=list[ClipCandidateRead])
def list_all_clips_endpoint(
    statuses: str | None = Query(default=None, description="Comma separated clip statuses"),
    db: Session = Depends(get_db),
) -> list[dict]:
    statement = select(ClipCandidate).options(selectinload(ClipCandidate.exports)).order_by(ClipCandidate.created_at.desc())
    if statuses:
        allowed = [status.strip() for status in statuses.split(",") if status.strip()]
        if allowed:
            statement = statement.where(ClipCandidate.status.in_(allowed))
    clips = db.scalars(statement).unique().all()
    return [serialize_clip(clip) for clip in clips]


@router.patch("/clips/{clip_id}", response_model=ClipCandidateRead)
def update_clip_endpoint(clip_id: int, payload: ClipCandidateUpdate, db: Session = Depends(get_db)) -> dict:
    clip = get_clip_or_404(db, clip_id)
    update_data = payload.model_dump(exclude_unset=True)
    next_start = update_data.get("start_time", clip.start_time)
    next_end = update_data.get("end_time", clip.end_time)
    source_duration = clip.project.source_videos[0].duration_seconds if clip.project and clip.project.source_videos else None
    clip.start_time = next_start
    clip.end_time = next_end
    clip.duration = validate_clip_window(clip.start_time, clip.end_time, max_source_duration=source_duration)
    for field in ["suggested_title", "suggested_description", "suggested_hashtags", "subtitle_preset"]:
        if field in update_data:
            setattr(clip, field, update_data[field])
    db.add(clip)
    db.commit()
    db.refresh(clip)
    return serialize_clip(get_clip_or_404(db, clip_id))


@router.post("/clips/{clip_id}/approve", response_model=ClipCandidateRead)
def approve_clip_endpoint(clip_id: int, db: Session = Depends(get_db)) -> dict:
    clip = get_clip_or_404(db, clip_id)
    transition_clip_status(clip, ClipStatus.approved)
    db.add(clip)
    db.commit()
    return serialize_clip(get_clip_or_404(db, clip_id))


@router.post("/clips/{clip_id}/reject", response_model=ClipCandidateRead)
def reject_clip_endpoint(clip_id: int, db: Session = Depends(get_db)) -> dict:
    clip = get_clip_or_404(db, clip_id)
    transition_clip_status(clip, ClipStatus.rejected)
    db.add(clip)
    db.commit()
    return serialize_clip(get_clip_or_404(db, clip_id))


@router.post("/clips/{clip_id}/export", response_model=ExportRead)
def export_clip_endpoint(clip_id: int, db: Session = Depends(get_db)) -> dict:
    clip = get_clip_or_404(db, clip_id)
    project = get_project_or_404(db, clip.project_id)
    transcript = latest_transcript(project)
    source_video = latest_source_video(project)
    if not transcript:
        raise HTTPException(status_code=400, detail="Transcript is required before export")
    if not source_video:
        raise HTTPException(status_code=400, detail="Source video is required before export")
    export_record = export_clip(db, clip, project, transcript, source_video.stored_path, source_duration_seconds=source_video.duration_seconds)
    refreshed_export = db.scalar(
        select(Export)
        .where(Export.id == export_record.id)
        .options(selectinload(Export.clip_candidate))
    )
    return serialize_export(refreshed_export or export_record)


@router.post("/clips/{clip_id}/export/start", response_model=WorkflowJobRead, status_code=202)
def start_export_clip_endpoint(
    clip_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> dict:
    clip = get_clip_or_404(db, clip_id)
    project = get_project_or_404(db, clip.project_id)
    transcript = latest_transcript(project)
    source_video = latest_source_video(project)
    if not transcript:
        raise HTTPException(status_code=400, detail="Transcript is required before export")
    if not source_video:
        raise HTTPException(status_code=400, detail="Source video is required before export")
    job = create_workflow_job(
        db,
        project=project,
        clip=clip,
        job_type=WorkflowJobType.export,
        message="Vertical export has been queued",
    )
    background_tasks.add_task(run_export_job, job.id)
    return serialize_workflow_job(job)


@router.post("/clips/{clip_id}/queue-publish", response_model=PublishJobRead)
def queue_publish_endpoint(
    clip_id: int,
    payload: QueuePublishRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> dict:
    clip = get_clip_or_404(db, clip_id)
    publish_job = create_publish_job(db, clip, payload.platform)
    background_tasks.add_task(simulate_publish_job, publish_job.id)
    refreshed = db.scalar(
        select(PublishJob)
        .where(PublishJob.id == publish_job.id)
        .options(selectinload(PublishJob.clip_candidate))
    )
    return serialize_publish_job(refreshed or publish_job)


@router.post("/clips/{clip_id}/queue-publish/start", response_model=WorkflowJobRead, status_code=202)
def start_queue_publish_endpoint(
    clip_id: int,
    payload: QueuePublishRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> dict:
    clip = get_clip_or_404(db, clip_id)
    project = get_project_or_404(db, clip.project_id)
    job = create_workflow_job(
        db,
        project=project,
        clip=clip,
        job_type=WorkflowJobType.publish,
        payload_json={"platform": payload.platform},
        message=f"Mock publish for {payload.platform} has been queued",
    )
    background_tasks.add_task(run_publish_job, job.id)
    return serialize_workflow_job(job)


@router.get("/clips/{clip_id}/jobs", response_model=list[WorkflowJobRead])
def list_clip_jobs_endpoint(clip_id: int, db: Session = Depends(get_db)) -> list[dict]:
    get_clip_or_404(db, clip_id)
    return [serialize_workflow_job(job) for job in list_clip_jobs(db, clip_id)]
