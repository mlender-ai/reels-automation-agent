from pathlib import Path

from app.core.config import settings
from app.utils.files import safe_filename, slugify_text


def ensure_app_directories() -> None:
    for path in [
        settings.data_dir,
        settings.input_dir,
        settings.projects_dir,
        settings.exports_dir,
        settings.temp_dir,
        settings.whisper_download_root,
    ]:
        path.mkdir(parents=True, exist_ok=True)


def project_dir(project_id: int) -> Path:
    return settings.projects_dir / str(project_id)


def project_source_dir(project_id: int) -> Path:
    return project_dir(project_id) / "source"


def project_transcripts_dir(project_id: int) -> Path:
    return project_dir(project_id) / "transcripts"


def project_clips_dir(project_id: int) -> Path:
    return project_dir(project_id) / "clips"


def project_exports_dir(project_id: int) -> Path:
    return project_dir(project_id) / "exports"


def ensure_project_directories(project_id: int) -> None:
    for path in [
        project_dir(project_id),
        project_source_dir(project_id),
        project_transcripts_dir(project_id),
        project_clips_dir(project_id),
        project_exports_dir(project_id),
    ]:
        path.mkdir(parents=True, exist_ok=True)


def build_upload_target(project_id: int, filename: str) -> Path:
    return project_source_dir(project_id) / safe_filename(filename)


def build_export_basename(clip_id: int, title: str, timestamp: str) -> str:
    return f"clip-{clip_id}-{slugify_text(title, max_length=36)}-{timestamp}"


def to_relative_data_path(path: Path) -> str:
    return path.resolve().relative_to(settings.data_dir.resolve()).as_posix()


def resolve_data_path(relative_or_absolute: str | Path) -> Path:
    path = Path(relative_or_absolute)
    return path if path.is_absolute() else settings.data_dir / path


def public_file_url(relative_path: str | None) -> str | None:
    if not relative_path:
        return None
    cleaned = relative_path.lstrip("/")
    return f"/files/{cleaned}"
