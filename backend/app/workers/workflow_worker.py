from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.constants import WorkflowJobStatus, WorkflowJobType
from app.core.logging import get_logger
from app.db.session import SessionLocal
from app.models.clip_candidate import ClipCandidate
from app.models.project import Project
from app.models.publish_job import PublishJob
from app.models.workflow_job import WorkflowJob
from app.services.clip_scoring_service import generate_clip_candidates
from app.services.export_service import export_clip
from app.services.project_service import latest_source_video, latest_transcript
from app.services.publish_service import create_publish_job
from app.services.transcription_service import transcribe_project
from app.services.workflow_job_service import get_workflow_job_or_404, update_workflow_job
from app.workers.publish_worker import simulate_publish_job

logger = get_logger(__name__)


def _load_workflow_job(db, job_id: int) -> WorkflowJob | None:
    return db.scalar(
        select(WorkflowJob)
        .where(WorkflowJob.id == job_id)
        .options(
            selectinload(WorkflowJob.project).selectinload(Project.source_videos),
            selectinload(WorkflowJob.project).selectinload(Project.transcripts),
            selectinload(WorkflowJob.project).selectinload(Project.clip_candidates).selectinload(ClipCandidate.exports),
            selectinload(WorkflowJob.clip_candidate).selectinload(ClipCandidate.exports),
            selectinload(WorkflowJob.clip_candidate).selectinload(ClipCandidate.publish_jobs),
        )
    )


def run_transcription_job(job_id: int) -> None:
    with SessionLocal() as db:
        job = _load_workflow_job(db, job_id)
        if not job:
            logger.warning("Transcription workflow job missing. job_id=%s", job_id)
            return

        try:
            update_workflow_job(
                db,
                job,
                status=WorkflowJobStatus.running,
                progress=15,
                message="Preparing faster-whisper transcription",
                started=True,
                result_json={"job_type": WorkflowJobType.transcribe.value},
            )
            job = get_workflow_job_or_404(db, job_id)
            project = job.project
            source_video = latest_source_video(project)
            if not source_video:
                raise HTTPException(status_code=400, detail="Project has no uploaded source video")
            transcript = transcribe_project(db, project, source_video)
            update_workflow_job(
                db,
                get_workflow_job_or_404(db, job_id),
                status=WorkflowJobStatus.completed,
                progress=100,
                message="Transcript extracted and saved",
                completed=True,
                result_json={"transcript_id": transcript.id, "language": transcript.language, "project_status": project.status},
            )
            logger.info("Transcription workflow job completed. job_id=%s project_id=%s", job_id, project.id)
        except HTTPException as exc:
            update_workflow_job(
                db,
                get_workflow_job_or_404(db, job_id),
                status=WorkflowJobStatus.failed,
                progress=100,
                message="Transcript extraction failed",
                error_detail=str(exc.detail),
                completed=True,
                result_json={"job_type": WorkflowJobType.transcribe.value, "error": str(exc.detail)},
            )
            logger.warning("Transcription workflow job failed. job_id=%s detail=%s", job_id, exc.detail)
        except Exception as exc:
            update_workflow_job(
                db,
                get_workflow_job_or_404(db, job_id),
                status=WorkflowJobStatus.failed,
                progress=100,
                message="Transcript extraction failed unexpectedly",
                error_detail=str(exc),
                completed=True,
                result_json={"job_type": WorkflowJobType.transcribe.value, "error": str(exc)},
            )
            logger.exception("Unexpected transcription workflow job failure. job_id=%s", job_id)


def run_clip_generation_job(job_id: int) -> None:
    with SessionLocal() as db:
        job = _load_workflow_job(db, job_id)
        if not job:
            logger.warning("Clip generation workflow job missing. job_id=%s", job_id)
            return

        try:
            update_workflow_job(
                db,
                job,
                status=WorkflowJobStatus.running,
                progress=25,
                message="Scoring transcript windows for shortform candidates",
                started=True,
                result_json={"job_type": WorkflowJobType.generate_clips.value},
            )
            job = get_workflow_job_or_404(db, job_id)
            project = job.project
            transcript = latest_transcript(project)
            if not transcript:
                raise HTTPException(status_code=400, detail="Generate a transcript before generating clips")
            clips = generate_clip_candidates(db, project, transcript)
            update_workflow_job(
                db,
                get_workflow_job_or_404(db, job_id),
                status=WorkflowJobStatus.completed,
                progress=100,
                message=f"Generated {len(clips)} ranked clip candidates",
                completed=True,
                result_json={"clip_count": len(clips), "clip_ids": [clip.id for clip in clips], "project_status": project.status},
            )
            logger.info("Clip generation workflow job completed. job_id=%s project_id=%s count=%s", job_id, project.id, len(clips))
        except HTTPException as exc:
            update_workflow_job(
                db,
                get_workflow_job_or_404(db, job_id),
                status=WorkflowJobStatus.failed,
                progress=100,
                message="Clip generation failed",
                error_detail=str(exc.detail),
                completed=True,
                result_json={"job_type": WorkflowJobType.generate_clips.value, "error": str(exc.detail)},
            )
            logger.warning("Clip generation workflow job failed. job_id=%s detail=%s", job_id, exc.detail)
        except Exception as exc:
            update_workflow_job(
                db,
                get_workflow_job_or_404(db, job_id),
                status=WorkflowJobStatus.failed,
                progress=100,
                message="Clip generation failed unexpectedly",
                error_detail=str(exc),
                completed=True,
                result_json={"job_type": WorkflowJobType.generate_clips.value, "error": str(exc)},
            )
            logger.exception("Unexpected clip generation workflow job failure. job_id=%s", job_id)


def run_export_job(job_id: int) -> None:
    with SessionLocal() as db:
        job = _load_workflow_job(db, job_id)
        if not job:
            logger.warning("Export workflow job missing. job_id=%s", job_id)
            return

        try:
            update_workflow_job(
                db,
                job,
                status=WorkflowJobStatus.running,
                progress=20,
                message="Preparing subtitles and vertical export",
                started=True,
                result_json={"job_type": WorkflowJobType.export.value},
            )
            job = get_workflow_job_or_404(db, job_id)
            clip = job.clip_candidate
            if not clip:
                raise HTTPException(status_code=404, detail="Clip candidate not found for export workflow")
            project = job.project
            transcript = latest_transcript(project)
            source_video = latest_source_video(project)
            if not transcript:
                raise HTTPException(status_code=400, detail="Transcript is required before export")
            if not source_video:
                raise HTTPException(status_code=400, detail="Source video is required before export")
            export_record = export_clip(
                db,
                clip,
                project,
                transcript,
                source_video.stored_path,
                source_duration_seconds=source_video.duration_seconds,
            )
            update_workflow_job(
                db,
                get_workflow_job_or_404(db, job_id),
                status=WorkflowJobStatus.completed,
                progress=100,
                message="Vertical export completed",
                completed=True,
                result_json={
                    "export_id": export_record.id,
                    "export_status": export_record.status,
                    "output_path": export_record.output_path,
                },
            )
            logger.info("Export workflow job completed. job_id=%s clip_id=%s export_id=%s", job_id, clip.id, export_record.id)
        except HTTPException as exc:
            update_workflow_job(
                db,
                get_workflow_job_or_404(db, job_id),
                status=WorkflowJobStatus.failed,
                progress=100,
                message="Export failed",
                error_detail=str(exc.detail),
                completed=True,
                result_json={"job_type": WorkflowJobType.export.value, "error": str(exc.detail)},
            )
            logger.warning("Export workflow job failed. job_id=%s detail=%s", job_id, exc.detail)
        except Exception as exc:
            update_workflow_job(
                db,
                get_workflow_job_or_404(db, job_id),
                status=WorkflowJobStatus.failed,
                progress=100,
                message="Export failed unexpectedly",
                error_detail=str(exc),
                completed=True,
                result_json={"job_type": WorkflowJobType.export.value, "error": str(exc)},
            )
            logger.exception("Unexpected export workflow job failure. job_id=%s", job_id)


def run_publish_job(job_id: int) -> None:
    with SessionLocal() as db:
        job = _load_workflow_job(db, job_id)
        if not job:
            logger.warning("Publish workflow job missing. job_id=%s", job_id)
            return

        try:
            platform = (job.payload_json or {}).get("platform")
            if not platform:
                raise HTTPException(status_code=400, detail="Publish platform is missing from the workflow payload")
            update_workflow_job(
                db,
                job,
                status=WorkflowJobStatus.running,
                progress=15,
                message=f"Queueing mock publish job for {platform}",
                started=True,
                result_json={"job_type": WorkflowJobType.publish.value, "platform": platform},
            )
            job = get_workflow_job_or_404(db, job_id)
            clip = job.clip_candidate
            if not clip:
                raise HTTPException(status_code=404, detail="Clip candidate not found for publish workflow")
            publish_job = create_publish_job(db, clip, str(platform))
            update_workflow_job(
                db,
                get_workflow_job_or_404(db, job_id),
                progress=60,
                message=f"Mock {platform} adapter is processing the queued publish job",
                result_json={"publish_job_id": publish_job.id},
            )
            simulate_publish_job(publish_job.id)
            refreshed_publish_job = db.scalar(
                select(PublishJob)
                .where(PublishJob.id == publish_job.id)
                .options(selectinload(PublishJob.clip_candidate))
            )
            if not refreshed_publish_job:
                raise HTTPException(status_code=500, detail="Publish job could not be reloaded after processing")
            terminal_status = (
                WorkflowJobStatus.completed
                if refreshed_publish_job.status != WorkflowJobStatus.failed.value
                else WorkflowJobStatus.failed
            )
            message = (
                f"Mock publish completed for {platform}"
                if refreshed_publish_job.status != "failed"
                else f"Mock publish failed for {platform}"
            )
            error_detail = None if refreshed_publish_job.status != "failed" else "The mock adapter returned a failed result."
            update_workflow_job(
                db,
                get_workflow_job_or_404(db, job_id),
                status=terminal_status,
                progress=100,
                message=message,
                error_detail=error_detail,
                completed=True,
                result_json={
                    "publish_job_id": refreshed_publish_job.id,
                    "publish_status": refreshed_publish_job.status,
                    "platform": platform,
                },
            )
            logger.info(
                "Publish workflow job finished. workflow_job_id=%s publish_job_id=%s platform=%s status=%s",
                job_id,
                refreshed_publish_job.id,
                platform,
                refreshed_publish_job.status,
            )
        except HTTPException as exc:
            update_workflow_job(
                db,
                get_workflow_job_or_404(db, job_id),
                status=WorkflowJobStatus.failed,
                progress=100,
                message="Publish queue failed",
                error_detail=str(exc.detail),
                completed=True,
                result_json={"job_type": WorkflowJobType.publish.value, "error": str(exc.detail)},
            )
            logger.warning("Publish workflow job failed. job_id=%s detail=%s", job_id, exc.detail)
        except Exception as exc:
            update_workflow_job(
                db,
                get_workflow_job_or_404(db, job_id),
                status=WorkflowJobStatus.failed,
                progress=100,
                message="Publish queue failed unexpectedly",
                error_detail=str(exc),
                completed=True,
                result_json={"job_type": WorkflowJobType.publish.value, "error": str(exc)},
            )
            logger.exception("Unexpected publish workflow job failure. job_id=%s", job_id)
