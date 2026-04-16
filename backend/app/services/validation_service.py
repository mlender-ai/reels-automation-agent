from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException


ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".mov", ".m4v", ".webm", ".mkv"}
MAX_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024 * 1024
MIN_CLIP_DURATION_SECONDS = 8.0
MAX_CLIP_DURATION_SECONDS = 45.0


def validate_video_upload(filename: str, content_type: str | None, size_bytes: int) -> None:
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_VIDEO_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_VIDEO_EXTENSIONS))
        raise HTTPException(status_code=400, detail=f"Unsupported video file type. Allowed extensions: {allowed}")

    normalized_content_type = (content_type or "").strip().lower()
    if normalized_content_type and not normalized_content_type.startswith("video/") and normalized_content_type != "application/octet-stream":
        raise HTTPException(status_code=400, detail=f"Unsupported upload content type: {normalized_content_type}")

    if size_bytes <= 0:
        raise HTTPException(status_code=400, detail="Uploaded video file is empty")

    if size_bytes > MAX_UPLOAD_SIZE_BYTES:
        max_size_mb = MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)
        raise HTTPException(status_code=400, detail=f"Uploaded video exceeds the {max_size_mb} MB size limit")


def validate_clip_window(start_time: float, end_time: float) -> float:
    if end_time <= start_time:
        raise HTTPException(status_code=422, detail="Clip end_time must be greater than start_time")

    duration = round(end_time - start_time, 3)
    if duration < MIN_CLIP_DURATION_SECONDS:
        raise HTTPException(
            status_code=422,
            detail=f"Clip duration must be at least {MIN_CLIP_DURATION_SECONDS:.0f} seconds",
        )
    if duration > MAX_CLIP_DURATION_SECONDS:
        raise HTTPException(
            status_code=422,
            detail=f"Clip duration must be {MAX_CLIP_DURATION_SECONDS:.0f} seconds or less",
        )
    return duration
