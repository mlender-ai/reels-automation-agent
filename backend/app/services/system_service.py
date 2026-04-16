import shutil
import subprocess
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.constants import ExportStatus, PublishStatus
from app.models.export import Export
from app.models.project import Project
from app.models.publish_job import PublishJob


def _detect_binary(binary_name: str) -> dict[str, str | bool | None]:
    resolved_path = shutil.which(binary_name)
    version: str | None = None
    if resolved_path:
        try:
            completed = subprocess.run(
                [binary_name, "-version"],
                check=True,
                capture_output=True,
                text=True,
            )
            version = (completed.stdout.splitlines() or completed.stderr.splitlines() or [""])[0][:180]
        except Exception:
            version = None
    return {
        "name": binary_name,
        "configured": binary_name,
        "available": bool(resolved_path),
        "resolved_path": resolved_path,
        "version": version,
    }


def get_system_status(db: Session) -> dict:
    binaries = [_detect_binary(settings.ffmpeg_binary), _detect_binary(settings.ffprobe_binary)]
    storage_paths = [
        ("data", settings.data_dir),
        ("projects", settings.projects_dir),
        ("exports", settings.exports_dir),
        ("temp", settings.temp_dir),
        ("whisper_models", settings.whisper_download_root),
    ]
    total_projects = db.scalar(select(func.count(Project.id))) or 0
    completed_exports = db.scalar(select(func.count(Export.id)).where(Export.status == ExportStatus.completed.value)) or 0
    queued_publish_jobs = db.scalar(select(func.count(PublishJob.id)).where(PublishJob.status == PublishStatus.queued.value)) or 0
    return {
        "api_status": "ok",
        "database_url": settings.database_url,
        "whisper_model_size": settings.whisper_model_size,
        "whisper_device": settings.whisper_device,
        "binaries": binaries,
        "storage": [
            {"name": name, "path": str(Path(path).resolve()), "exists": Path(path).exists()}
            for name, path in storage_paths
        ],
        "total_projects": total_projects,
        "completed_exports": completed_exports,
        "queued_publish_jobs": queued_publish_jobs,
    }
