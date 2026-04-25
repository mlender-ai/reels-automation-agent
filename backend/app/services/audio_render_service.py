from __future__ import annotations

import subprocess
from pathlib import Path

from fastapi import HTTPException

from app.core.config import settings
from app.core.logging import get_logger
from app.services.shorts_story_service import ClipStoryPackage
from app.utils.paths import project_exports_dir


logger = get_logger(__name__)


def _run_local_command(command: list[str], error_prefix: str) -> None:
    try:
        subprocess.run(command, check=True, capture_output=True, text=True)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=f"{error_prefix}: required local binary was not found.") from exc
    except subprocess.CalledProcessError as exc:
        detail = exc.stderr.strip() or exc.stdout.strip() or "Unknown command failure"
        raise HTTPException(status_code=500, detail=f"{error_prefix}: {detail}") from exc


def build_voiceover_copy(clip, story_package: ClipStoryPackage) -> str:
    lines: list[str] = []
    for candidate in [clip.suggested_description, story_package.supporting_line, *story_package.analysis_outline]:
        normalized = " ".join((candidate or "").split()).strip()
        if not normalized:
            continue
        normalized = normalized.rstrip(".!?")
        if normalized and normalized not in lines:
            lines.append(normalized)
        if len(lines) == 3:
            break

    if not lines:
        lines = [clip.suggested_title or story_package.analysis_headline]

    return ". ".join(lines) + "."


def render_voiceover_audio(project_id: int, clip_id: int, base_name: str, voiceover_copy: str) -> Path:
    exports_dir = project_exports_dir(project_id)
    exports_dir.mkdir(parents=True, exist_ok=True)
    output_path = exports_dir / f"{base_name}-tts.aiff"
    preferred_voices = ["Yuna", "Yuri", "Sora", "Kyoko"]

    for voice in preferred_voices:
        command = ["say", "-v", voice, "-r", "220", "-o", str(output_path.resolve()), voiceover_copy]
        try:
            _run_local_command(command, "Unable to synthesize local voiceover")
            logger.info("Rendered local TTS. project_id=%s clip_id=%s voice=%s", project_id, clip_id, voice)
            return output_path
        except HTTPException:
            continue

    fallback_command = ["say", "-r", "220", "-o", str(output_path.resolve()), voiceover_copy]
    _run_local_command(fallback_command, "Unable to synthesize local voiceover")
    logger.info("Rendered local TTS with default voice. project_id=%s clip_id=%s", project_id, clip_id)
    return output_path


def render_background_music(project_id: int, clip_id: int, base_name: str, duration: float) -> Path:
    exports_dir = project_exports_dir(project_id)
    exports_dir.mkdir(parents=True, exist_ok=True)
    output_path = exports_dir / f"{base_name}-bgm.wav"
    safe_duration = max(4.0, duration + 0.25)
    fade_out_start = max(safe_duration - 1.2, 0.0)
    filter_complex = (
        "[0:a]volume=0.028[a0];"
        "[1:a]volume=0.018[a1];"
        "[2:a]highpass=f=320,lowpass=f=2200,volume=0.010[a2];"
        f"[a0][a1][a2]amix=inputs=3:dropout_transition=0:normalize=0,"
        f"afade=t=in:st=0:d=0.8,afade=t=out:st={fade_out_start:.2f}:d=1.0[aout]"
    )
    command = [
        settings.ffmpeg_binary,
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-i",
        f"sine=frequency=92:sample_rate=44100:duration={safe_duration:.2f}",
        "-f",
        "lavfi",
        "-i",
        f"sine=frequency=184:sample_rate=44100:duration={safe_duration:.2f}",
        "-f",
        "lavfi",
        "-i",
        f"anoisesrc=color=pink:amplitude=0.2:sample_rate=44100:duration={safe_duration:.2f}",
        "-filter_complex",
        filter_complex,
        "-map",
        "[aout]",
        str(output_path.resolve()),
    ]
    _run_local_command(command, "Unable to generate background music bed")
    logger.info("Rendered background music bed. project_id=%s clip_id=%s", project_id, clip_id)
    return output_path
