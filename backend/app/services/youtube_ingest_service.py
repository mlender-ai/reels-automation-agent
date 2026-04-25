from __future__ import annotations

import shutil
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import get_logger
from app.models.project import Project
from app.services.project_service import save_downloaded_source
from app.utils.files import safe_filename
from app.utils.paths import ensure_project_directories, project_source_dir


logger = get_logger(__name__)

if settings.ytdlp_vendor_path.exists():
    vendor_path = str(settings.ytdlp_vendor_path.resolve())
    if vendor_path not in sys.path:
        sys.path.insert(0, vendor_path)

try:
    from yt_dlp import YoutubeDL
except Exception:  # pragma: no cover - optional runtime dependency
    YoutubeDL = None


ALLOWED_YOUTUBE_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
    "www.youtu.be",
}
VIDEO_EXTENSIONS = {".mp4", ".mkv", ".webm", ".mov", ".m4v"}


def _normalize_youtube_url(url: str) -> str:
    normalized = url.strip()
    parsed = urlparse(normalized)
    host = parsed.netloc.lower()
    if host not in ALLOWED_YOUTUBE_HOSTS:
        raise HTTPException(status_code=400, detail="Only YouTube video URLs are supported for this import flow.")

    if host.endswith("youtu.be"):
        if not parsed.path.strip("/"):
            raise HTTPException(status_code=400, detail="The YouTube short-link is missing a video id.")
        return normalized

    if parsed.path.startswith("/watch"):
        video_id = parse_qs(parsed.query).get("v", [""])[0]
        if not video_id:
            raise HTTPException(status_code=400, detail="The YouTube watch URL is missing a video id.")
        return normalized

    if parsed.path.startswith("/shorts/"):
        video_id = parsed.path.split("/shorts/", 1)[1].split("/", 1)[0]
        if not video_id:
            raise HTTPException(status_code=400, detail="The YouTube Shorts URL is missing a video id.")
        return normalized

    raise HTTPException(status_code=400, detail="Only direct YouTube watch or Shorts URLs are supported.")


def _resolve_downloaded_media(download_dir: Path) -> Path:
    candidates = [path for path in download_dir.iterdir() if path.is_file() and path.suffix.lower() in VIDEO_EXTENSIONS and not path.name.endswith(".part")]
    if not candidates:
        raise HTTPException(
            status_code=400,
            detail="The YouTube import finished without a supported local video file. Try another link or a different source.",
        )
    return max(candidates, key=lambda path: path.stat().st_size)


def _default_filename(info: dict) -> str:
    title = str(info.get("title") or info.get("id") or "youtube-source").strip()
    ext = str(info.get("ext") or "mp4").lower()
    suffix = f".{ext}" if not ext.startswith(".") else ext
    return safe_filename(f"{title}{suffix}")


def import_youtube_source(db: Session, project: Project, url: str) -> Project:
    if not settings.ytdlp_enabled:
        raise HTTPException(status_code=400, detail="YouTube URL ingest is disabled in this local environment.")
    if YoutubeDL is None:
        raise HTTPException(
            status_code=500,
            detail="yt-dlp is not available in this environment. Install the local dependency before using YouTube URL ingest.",
        )

    normalized_url = _normalize_youtube_url(url)
    ensure_project_directories(project.id)
    source_dir = project_source_dir(project.id)
    temp_dir = source_dir / "__youtube_ingest__"
    shutil.rmtree(temp_dir, ignore_errors=True)
    temp_dir.mkdir(parents=True, exist_ok=True)

    metadata_opts = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "skip_download": True,
    }
    download_opts = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "format": "bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "merge_output_format": "mp4",
        "outtmpl": str(temp_dir / "%(id)s.%(ext)s"),
        "restrictfilenames": False,
    }

    try:
        with YoutubeDL(metadata_opts) as ydl:
            info = ydl.extract_info(normalized_url, download=False)
        with YoutubeDL(download_opts) as ydl:
            ydl.extract_info(normalized_url, download=True)
        downloaded_file = _resolve_downloaded_media(temp_dir)
        logger.info("Imported YouTube source. project_id=%s url=%s file=%s", project.id, normalized_url, downloaded_file.name)
        return save_downloaded_source(db, project, downloaded_file, _default_filename(info))
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("YouTube URL ingest failed. project_id=%s url=%s", project.id, normalized_url)
        raise HTTPException(
            status_code=400,
            detail="Failed to import the YouTube link locally. Check the URL, network access, and whether the video is accessible, then retry.",
        ) from exc
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
