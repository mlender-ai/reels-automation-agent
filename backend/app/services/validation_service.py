from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException


ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".mov", ".m4v", ".webm", ".mkv"}
ALLOWED_VIDEO_CONTENT_TYPES = {
    "video/mp4",
    "video/quicktime",
    "video/x-m4v",
    "video/webm",
    "video/x-matroska",
    "video/mkv",
    "application/octet-stream",
}
MAX_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024 * 1024
MIN_CLIP_DURATION_SECONDS = 8.0
MAX_CLIP_DURATION_SECONDS = 45.0


def ensure_source_video_duration(duration_seconds: float | None) -> float:
    if duration_seconds is None or duration_seconds <= 0:
        raise HTTPException(status_code=422, detail="Source video duration could not be determined for clip generation")
    if duration_seconds < MIN_CLIP_DURATION_SECONDS:
        raise HTTPException(
            status_code=422,
            detail=f"Source video must be at least {MIN_CLIP_DURATION_SECONDS:.0f} seconds long before generating clips",
        )
    return duration_seconds


def validate_video_upload(filename: str, content_type: str | None, size_bytes: int) -> None:
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_VIDEO_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_VIDEO_EXTENSIONS))
        raise HTTPException(status_code=400, detail=f"Unsupported video file type. Allowed extensions: {allowed}")

    normalized_content_type = (content_type or "").strip().lower()
    if normalized_content_type and normalized_content_type not in ALLOWED_VIDEO_CONTENT_TYPES:
        allowed_types = ", ".join(sorted(ALLOWED_VIDEO_CONTENT_TYPES - {"application/octet-stream"}))
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported upload content type: {normalized_content_type}. Expected one of: {allowed_types}",
        )

    if size_bytes <= 0:
        raise HTTPException(status_code=400, detail="Uploaded video file is empty")

    if size_bytes > MAX_UPLOAD_SIZE_BYTES:
        max_size_mb = MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)
        raise HTTPException(status_code=400, detail=f"Uploaded video exceeds the {max_size_mb} MB size limit")


def validate_clip_window(start_time: float, end_time: float, max_source_duration: float | None = None) -> float:
    if start_time < 0 or end_time < 0:
        raise HTTPException(status_code=422, detail="Clip start_time and end_time must be zero or greater")
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
    if max_source_duration is not None and end_time > max_source_duration + 0.25:
        raise HTTPException(
            status_code=422,
            detail=f"Clip end_time must stay within the source video duration ({max_source_duration:.1f}s)",
        )
    return duration


def normalize_transcript_segments(raw_segments: list[dict]) -> list[dict]:
    normalized: list[dict] = []
    seen_signatures: set[tuple[float, float, str]] = set()

    for index, segment in enumerate(raw_segments):
        try:
            start = round(float(segment.get("start", 0.0)), 3)
            end = round(float(segment.get("end", 0.0)), 3)
        except (TypeError, ValueError):
            continue

        text = " ".join(str(segment.get("text", "")).split())
        if not text or end <= start:
            continue

        signature = (round(start, 2), round(end, 2), text.lower())
        if signature in seen_signatures:
            continue

        normalized.append(
            {
                "id": int(segment.get("id", index)),
                "start": start,
                "end": end,
                "text": text,
            }
        )
        seen_signatures.add(signature)

    normalized.sort(key=lambda item: (item["start"], item["end"]))
    return normalized


def ensure_transcript_segments_available(segments: list[dict]) -> None:
    if not segments:
        raise HTTPException(status_code=422, detail="Transcript segments are empty or invalid")

    speech_duration = round(sum(segment["end"] - segment["start"] for segment in segments), 3)
    if len(segments) < 2 or speech_duration < MIN_CLIP_DURATION_SECONDS:
        raise HTTPException(
            status_code=422,
            detail="Transcript does not contain enough usable speech to produce clip candidates",
        )
