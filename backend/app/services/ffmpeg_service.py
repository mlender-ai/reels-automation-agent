import json
import shutil
import subprocess
import tempfile
from pathlib import Path

from fastapi import HTTPException

from app.core.config import settings
from app.services.overlay_render_service import RenderedOverlayAsset


def _humanize_command_error(detail: str, error_prefix: str) -> str:
    lowered = detail.lower()
    if "no space left on device" in lowered:
        return f"{error_prefix}: The local disk ran out of space while processing media."
    if "moov atom not found" in lowered or "invalid data found when processing input" in lowered:
        return f"{error_prefix}: FFmpeg could not read the local source video. Re-export or replace the file and try again."
    if "no such filter: 'subtitles'" in lowered or "filter not found" in lowered and "subtitles" in lowered:
        return f"{error_prefix}: This FFmpeg build does not support subtitle burn-in. Install FFmpeg with libass support and try again."
    if "no such file or directory" in lowered and "subtitles" in lowered:
        return f"{error_prefix}: The generated subtitle file could not be found during export."
    if "permission denied" in lowered:
        return f"{error_prefix}: The app does not have permission to read or write one of the media files."
    trimmed = detail.splitlines()[:4]
    return f"{error_prefix}: {' '.join(trimmed)}"


def _run_command(command: list[str], error_prefix: str) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(command, check=True, capture_output=True, text=True)
    except FileNotFoundError as exc:
        binary = Path(command[0]).name if command else "binary"
        raise HTTPException(status_code=500, detail=f"{error_prefix}: Required binary `{binary}` was not found on PATH.") from exc
    except subprocess.CalledProcessError as exc:
        detail = exc.stderr.strip() or exc.stdout.strip() or "Unknown FFmpeg error"
        raise HTTPException(status_code=500, detail=_humanize_command_error(detail, error_prefix)) from exc


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
    overlay_assets: list[RenderedOverlayAsset] | None = None,
    burn_in_subtitles: bool = True,
) -> None:
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    subtitle_source = Path(subtitle_path)
    if burn_in_subtitles and not subtitle_source.exists():
        raise HTTPException(status_code=500, detail="Unable to export clip: subtitle file is missing before FFmpeg starts.")
    temporary_subtitle_copy: Path | None = None
    try:
        if burn_in_subtitles:
            with tempfile.NamedTemporaryFile(prefix="raa-subtitles-", suffix=".srt", delete=False) as handle:
                temporary_subtitle_copy = Path(handle.name)
            shutil.copy2(subtitle_source, temporary_subtitle_copy)
            escaped_subtitle_path = _escape_subtitle_path(temporary_subtitle_copy)
            subtitle_filter = f",subtitles=filename='{escaped_subtitle_path}':force_style='{preset_style}'"
        else:
            subtitle_filter = ""

        overlay_assets = overlay_assets or []
        filter_parts = [
            "scale=1080:1920:force_original_aspect_ratio=increase,"
            "crop=1080:1920,"
            "setsar=1"
            f"{subtitle_filter}"
        ]
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
        ]
        if overlay_assets:
            filter_chain = [f"[0:v]{filter_parts[0]}[v0]"]
            for asset in overlay_assets:
                command.extend(["-i", str(asset.path.resolve())])
            current_label = "v0"
            for index, asset in enumerate(overlay_assets, start=1):
                next_label = f"v{index}"
                enable = ""
                if asset.end is not None:
                    asset_start = 0.0 if asset.start is None else asset.start
                    enable = f":enable='between(t,{asset_start:.2f},{asset.end:.2f})'"
                filter_chain.append(f"[{current_label}][{index}:v]overlay={asset.x}:{asset.y}{enable}[{next_label}]")
                current_label = next_label
            command.extend(
                [
                    "-t",
                    f"{duration:.3f}",
                    "-filter_complex",
                    ";".join(filter_chain),
                    "-map",
                    f"[{current_label}]",
                    "-map",
                    "0:a?",
                ]
            )
        else:
            command.extend(
                [
                    "-t",
                    f"{duration:.3f}",
                    "-map",
                    "0:v:0",
                    "-map",
                    "0:a?",
                    "-vf",
                    filter_parts[0],
                ]
            )
        command.extend(
            [
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
        )
        _run_command(command, "Unable to export clip")
    finally:
        if temporary_subtitle_copy is not None:
            temporary_subtitle_copy.unlink(missing_ok=True)


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
