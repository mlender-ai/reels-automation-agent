from app.models.clip_candidate import ClipCandidate
from app.models.export import Export
from app.models.project import Project
from app.models.publish_job import PublishJob
from app.models.source_video import SourceVideo
from app.models.transcript import Transcript
from app.models.workflow_job import WorkflowJob
from app.services.clip_strategy_service import build_clip_strategy
from app.services.transcription_service import load_transcript_segments
from app.utils.paths import public_file_url


def serialize_source_video(source_video: SourceVideo | None) -> dict | None:
    if not source_video:
        return None
    return {
        "id": source_video.id,
        "project_id": source_video.project_id,
        "original_filename": source_video.original_filename,
        "stored_path": source_video.stored_path,
        "file_url": public_file_url(source_video.stored_path),
        "duration_seconds": source_video.duration_seconds,
        "width": source_video.width,
        "height": source_video.height,
        "fps": source_video.fps,
        "created_at": source_video.created_at,
    }


def serialize_transcript(transcript: Transcript | None, include_segments: bool = True) -> dict | None:
    if not transcript:
        return None
    return {
        "id": transcript.id,
        "project_id": transcript.project_id,
        "language": transcript.language,
        "model_name": transcript.model_name,
        "raw_json_path": transcript.raw_json_path,
        "raw_json_url": public_file_url(transcript.raw_json_path),
        "text": transcript.text,
        "created_at": transcript.created_at,
        "segments": load_transcript_segments(transcript) if include_segments else [],
    }


def serialize_export(export_record: Export | None) -> dict | None:
    if not export_record:
        return None
    clip_title = export_record.clip_candidate.suggested_title if getattr(export_record, "clip_candidate", None) else None
    project_id = export_record.clip_candidate.project_id if getattr(export_record, "clip_candidate", None) else None
    return {
        "id": export_record.id,
        "clip_candidate_id": export_record.clip_candidate_id,
        "output_path": export_record.output_path,
        "output_url": public_file_url(export_record.output_path),
        "subtitle_path": export_record.subtitle_path,
        "subtitle_url": public_file_url(export_record.subtitle_path),
        "thumbnail_path": export_record.thumbnail_path,
        "thumbnail_url": public_file_url(export_record.thumbnail_path),
        "status": export_record.status,
        "created_at": export_record.created_at,
        "updated_at": export_record.updated_at,
        "clip_title": clip_title,
        "project_id": project_id,
    }


def serialize_clip(clip: ClipCandidate) -> dict:
    latest_export = clip.exports[0] if clip.exports else None
    source_runtime_seconds = None
    if getattr(clip, "project", None) and getattr(clip.project, "source_videos", None):
        source_runtime_seconds = clip.project.source_videos[0].duration_seconds
    strategy = build_clip_strategy(
        hook_text=clip.hook_text,
        suggested_title=clip.suggested_title,
        suggested_description=clip.suggested_description,
        suggested_hashtags=clip.suggested_hashtags,
        duration=clip.duration,
        score=clip.score,
        start_time=clip.start_time,
        end_time=clip.end_time,
        source_runtime_seconds=source_runtime_seconds,
    )
    return {
        "id": clip.id,
        "project_id": clip.project_id,
        "start_time": clip.start_time,
        "end_time": clip.end_time,
        "duration": clip.duration,
        "score": clip.score,
        "hook_text": clip.hook_text,
        "suggested_title": clip.suggested_title,
        "suggested_description": clip.suggested_description,
        "suggested_hashtags": clip.suggested_hashtags,
        "subtitle_preset": clip.subtitle_preset,
        "status": clip.status,
        "created_at": clip.created_at,
        "updated_at": clip.updated_at,
        "recommended_format": strategy.recommended_format,
        "virality_label": strategy.virality_label,
        "selection_reason": strategy.selection_reason,
        "selection_signals": strategy.selection_signals,
        "timeline_label": strategy.timeline_label,
        "source_runtime_seconds": strategy.source_runtime_seconds,
        "latest_export": serialize_export(latest_export),
    }


def serialize_project(project: Project) -> dict:
    latest_source = project.source_videos[0] if project.source_videos else None
    latest_transcript = project.transcripts[0] if project.transcripts else None
    clips = project.clip_candidates or []
    completed_exports = sorted(
        [export_record for clip in clips for export_record in clip.exports if export_record.status == "completed"],
        key=lambda item: item.created_at,
        reverse=True,
    )
    pending_clip_count = len([clip for clip in clips if clip.status == "pending"])
    rejected_clip_count = len([clip for clip in clips if clip.status == "rejected"])
    approved_clip_count = len([clip for clip in clips if clip.status in {"approved", "exported"}])
    latest_export = completed_exports[0] if completed_exports else None
    next_action = "upload_source"
    if latest_source and not latest_transcript:
        next_action = "transcribe"
    elif latest_transcript and not clips:
        next_action = "generate_clips"
    elif clips and pending_clip_count:
        next_action = "review_clips"
    elif approved_clip_count:
        next_action = "export_or_publish"
    return {
        "id": project.id,
        "title": project.title,
        "source_type": project.source_type,
        "source_path": project.source_path,
        "status": project.status,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
        "source_video": serialize_source_video(latest_source),
        "latest_transcript": serialize_transcript(latest_transcript, include_segments=False),
        "clip_count": len(clips),
        "pending_clip_count": pending_clip_count,
        "rejected_clip_count": rejected_clip_count,
        "approved_clip_count": approved_clip_count,
        "export_count": len(completed_exports),
        "latest_export": serialize_export(latest_export),
        "transcript_status": "ready" if latest_transcript else "missing",
        "clip_generation_status": "ready" if clips else "missing",
        "next_action": next_action,
    }


def serialize_publish_job(job: PublishJob) -> dict:
    clip_title = job.clip_candidate.suggested_title if getattr(job, "clip_candidate", None) else None
    project_id = job.clip_candidate.project_id if getattr(job, "clip_candidate", None) else None
    return {
        "id": job.id,
        "clip_candidate_id": job.clip_candidate_id,
        "platform": job.platform,
        "adapter_name": job.adapter_name,
        "status": job.status,
        "payload_json": job.payload_json,
        "result_json": job.result_json,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
        "clip_title": clip_title,
        "project_id": project_id,
    }


def serialize_workflow_job(job: WorkflowJob) -> dict:
    clip_title = job.clip_candidate.suggested_title if getattr(job, "clip_candidate", None) else None
    project_title = job.project.title if getattr(job, "project", None) else None
    return {
        "id": job.id,
        "project_id": job.project_id,
        "clip_candidate_id": job.clip_candidate_id,
        "job_type": job.job_type,
        "status": job.status,
        "progress": job.progress,
        "message": job.message,
        "error_detail": job.error_detail,
        "payload_json": job.payload_json,
        "result_json": job.result_json,
        "started_at": job.started_at,
        "completed_at": job.completed_at,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
        "project_title": project_title,
        "clip_title": clip_title,
    }
