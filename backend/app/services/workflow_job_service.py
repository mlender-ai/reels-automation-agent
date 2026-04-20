from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import Select, select
from sqlalchemy.orm import Session, selectinload

from app.core.constants import WorkflowJobStatus, WorkflowJobType
from app.models.clip_candidate import ClipCandidate
from app.models.project import Project
from app.models.workflow_job import WorkflowJob

ACTIVE_WORKFLOW_JOB_STATUSES = {
    WorkflowJobStatus.queued.value,
    WorkflowJobStatus.running.value,
}


def _job_query() -> Select[tuple[WorkflowJob]]:
    return select(WorkflowJob).options(
        selectinload(WorkflowJob.project),
        selectinload(WorkflowJob.clip_candidate),
    )


def get_workflow_job_or_404(db: Session, job_id: int) -> WorkflowJob:
    job = db.scalar(_job_query().where(WorkflowJob.id == job_id))
    if not job:
        raise HTTPException(status_code=404, detail="Workflow job not found")
    return job


def list_project_jobs(db: Session, project_id: int, limit: int = 10) -> list[WorkflowJob]:
    statement = _job_query().where(WorkflowJob.project_id == project_id).order_by(WorkflowJob.created_at.desc()).limit(limit)
    return db.scalars(statement).unique().all()


def list_clip_jobs(db: Session, clip_id: int, limit: int = 10) -> list[WorkflowJob]:
    statement = _job_query().where(WorkflowJob.clip_candidate_id == clip_id).order_by(WorkflowJob.created_at.desc()).limit(limit)
    return db.scalars(statement).unique().all()


def _find_active_duplicate(
    db: Session,
    *,
    project_id: int,
    clip_candidate_id: int | None,
    job_type: str,
) -> WorkflowJob | None:
    statement = (
        _job_query()
        .where(WorkflowJob.project_id == project_id, WorkflowJob.job_type == job_type)
        .where(WorkflowJob.status.in_(ACTIVE_WORKFLOW_JOB_STATUSES))
        .order_by(WorkflowJob.created_at.desc())
    )
    if clip_candidate_id is None:
        statement = statement.where(WorkflowJob.clip_candidate_id.is_(None))
    else:
        statement = statement.where(WorkflowJob.clip_candidate_id == clip_candidate_id)
    return db.scalar(statement)


def create_workflow_job(
    db: Session,
    *,
    project: Project,
    job_type: WorkflowJobType | str,
    clip: ClipCandidate | None = None,
    payload_json: dict[str, Any] | None = None,
    message: str | None = None,
) -> WorkflowJob:
    job_type_value = job_type.value if isinstance(job_type, WorkflowJobType) else str(job_type)
    duplicate = _find_active_duplicate(
        db,
        project_id=project.id,
        clip_candidate_id=clip.id if clip else None,
        job_type=job_type_value,
    )
    if duplicate:
        raise HTTPException(
            status_code=409,
            detail=f"A {job_type_value.replace('_', ' ')} job is already queued or running for this target.",
        )

    job = WorkflowJob(
        project_id=project.id,
        clip_candidate_id=clip.id if clip else None,
        job_type=job_type_value,
        status=WorkflowJobStatus.queued.value,
        progress=0,
        message=message or "Queued",
        payload_json=payload_json,
        result_json={"status": WorkflowJobStatus.queued.value},
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return get_workflow_job_or_404(db, job.id)


def update_workflow_job(
    db: Session,
    job: WorkflowJob,
    *,
    status: WorkflowJobStatus | str | None = None,
    progress: int | None = None,
    message: str | None = None,
    error_detail: str | None = None,
    payload_json: dict[str, Any] | None = None,
    result_json: dict[str, Any] | None = None,
    started: bool = False,
    completed: bool = False,
) -> WorkflowJob:
    if status is not None:
        job.status = status.value if isinstance(status, WorkflowJobStatus) else str(status)
    if progress is not None:
        job.progress = max(0, min(100, int(progress)))
    if message is not None:
        job.message = message
    if error_detail is not None:
        job.error_detail = error_detail
    if payload_json is not None:
        job.payload_json = payload_json
    if result_json is not None:
        existing_result = job.result_json or {}
        job.result_json = {**existing_result, **result_json}
    if started and job.started_at is None:
        job.started_at = datetime.now(timezone.utc)
    if completed:
        job.completed_at = datetime.now(timezone.utc)
    db.add(job)
    db.commit()
    return get_workflow_job_or_404(db, job.id)
