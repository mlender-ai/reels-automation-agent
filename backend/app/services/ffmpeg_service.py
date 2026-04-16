import json
import subprocess
from pathlib import Path

from fastapi import HTTPException

from app.core.config import settings


def _run_command(command: list[str], error_prefix: str) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(command, check=True, capture_output=True, text=True)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=f"{error_prefix}: binary not found") from exc
    except subprocess.CalledProcessError as exc:
        detail = exc.stderr.strip() or exc.stdout.strip() or "Unknown FFmpeg error"
        trimmed = detail.splitlines()[:4]
        raise HTTPException(status_code=500, detail=f"{error_prefix}: {' '.join(trimmed)}") from exc


def _parse_fps(raw_fps: str | None) -> float | None:
    if not raw_fps or raw_fps == "0/0":
        return None
    if "/" in raw_fps:
        numerator, denominator = raw_fps.split("/", 1)
        if float(denominator) == 0:
            return None
        return round(float(numerator) / float(denominator), 3)
    return round(float(raw_fps), 3)


def probe_video(video_path: str | Path) -> dict[str, float | int | None]:
    absolute = str(Path(video_path).resolve())
    command = [
        settings.ffprobe_binary,
        "-hide_banner",
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        absolute,
    ]
    completed = _run_command(command, "Unable to inspect source video")
    payload = json.loads(completed.stdout)
    video_stream = next((stream for stream in payload.get("streams", []) if stream.get("codec_type") == "video"), {})
    duration = payload.get("format", {}).get("duration")
    return {
        "duration_seconds": round(float(duration), 3) if duration else None,
        "width": video_stream.get("width"),
        "height": video_stream.get("height"),
        "fps": _parse_fps(video_stream.get("avg_frame_rate") or video_stream.get("r_frame_rate")),
    }


def _escape_subtitle_path(subtitle_path: Path) -> str:
    raw = subtitle_path.resolve().as_posix()
    return raw.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")


def export_vertical_clip(
    input_path: str | Path,
    output_path: str | Path,
    subtitle_path: str | Path,
    start_time: float,
    duration: float,
    preset_style: str,
) -> None:
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    escaped_subtitle_path = _escape_subtitle_path(Path(subtitle_path))
    vf = (
        "scale=1080:1920:force_original_aspect_ratio=increase,"
        "crop=1080:1920,"
        "setsar=1,"
        f"subtitles='{escaped_subtitle_path}':force_style='{preset_style}'"
    )
    command = [
        settings.ffmpeg_binary,
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        f"{start_time:.3f}",
        "-i",
        str(Path(input_path).resolve()),
        "-t",
        f"{duration:.3f}",
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
        "-vf",
        vf,
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "20",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
        str(output.resolve()),
    ]
    _run_command(command, "Unable to export clip")


def extract_thumbnail(video_path: str | Path, thumbnail_path: str | Path, capture_time: float = 0.75) -> None:
    output = Path(thumbnail_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    command = [
        settings.ffmpeg_binary,
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        f"{capture_time:.3f}",
        "-i",
        str(Path(video_path).resolve()),
        "-frames:v",
        "1",
        str(output.resolve()),
    ]
    _run_command(command, "Unable to extract thumbnail")
