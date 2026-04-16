from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.clip import ClipCandidateRead
from app.schemas.project import ProjectCreate, ProjectDetail, ProjectRead, SourceVideoRead
from app.schemas.transcript import TranscriptRead
from app.services.clip_scoring_service import generate_clip_candidates
from app.services.project_service import (
    create_project,
    get_project_or_404,
    latest_source_video,
    latest_transcript,
    list_project_clips,
    list_projects,
    save_source_upload,
)
from app.services.serializers import serialize_clip, serialize_project, serialize_source_video, serialize_transcript
from app.services.transcription_service import transcribe_project


router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=ProjectDetail)
def create_project_endpoint(payload: ProjectCreate, db: Session = Depends(get_db)) -> dict:
    project = create_project(db, title=payload.title, source_type=payload.source_type)
    return serialize_project(project)


@router.get("", response_model=list[ProjectRead])
def list_projects_endpoint(db: Session = Depends(get_db)) -> list[dict]:
    return [serialize_project(project) for project in list_projects(db)]


@router.get("/{project_id}", response_model=ProjectDetail)
def get_project_endpoint(project_id: int, db: Session = Depends(get_db)) -> dict:
    project = get_project_or_404(db, project_id)
    return serialize_project(project)


@router.post("/{project_id}/upload", response_model=ProjectDetail)
def upload_source_video(
    project_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict:
    project = get_project_or_404(db, project_id)
    updated_project = save_source_upload(db, project, file)
    return serialize_project(updated_project)


@router.post("/{project_id}/transcribe", response_model=TranscriptRead)
def transcribe_endpoint(project_id: int, db: Session = Depends(get_db)) -> dict:
    project = get_project_or_404(db, project_id)
    source_video = latest_source_video(project)
    if not source_video:
        raise HTTPException(status_code=400, detail="Project has no uploaded source video")
    transcript = transcribe_project(db, project, source_video)
    return serialize_transcript(transcript)


@router.get("/{project_id}/transcript", response_model=TranscriptRead)
def get_transcript_endpoint(project_id: int, db: Session = Depends(get_db)) -> dict:
    project = get_project_or_404(db, project_id)
    transcript = latest_transcript(project)
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript has not been generated yet")
    return serialize_transcript(transcript)


@router.post("/{project_id}/generate-clips", response_model=list[ClipCandidateRead])
def generate_clips_endpoint(project_id: int, db: Session = Depends(get_db)) -> list[dict]:
    project = get_project_or_404(db, project_id)
    transcript = latest_transcript(project)
    if not transcript:
        raise HTTPException(status_code=400, detail="Generate a transcript before generating clips")
    clips = generate_clip_candidates(db, project, transcript)
    refreshed_project = get_project_or_404(db, project_id)
    return [serialize_clip(clip) for clip in refreshed_project.clip_candidates[: len(clips)]]


@router.get("/{project_id}/clips", response_model=list[ClipCandidateRead])
def list_clips_endpoint(project_id: int, db: Session = Depends(get_db)) -> list[dict]:
    get_project_or_404(db, project_id)
    clips = list_project_clips(db, project_id)
    return [serialize_clip(clip) for clip in clips]


@router.get("/{project_id}/source-video", response_model=SourceVideoRead)
def get_source_video_endpoint(project_id: int, db: Session = Depends(get_db)) -> dict:
    project = get_project_or_404(db, project_id)
    source_video = latest_source_video(project)
    if not source_video:
        raise HTTPException(status_code=404, detail="Source video has not been uploaded yet")
    return serialize_source_video(source_video)
