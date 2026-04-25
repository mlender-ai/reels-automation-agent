from __future__ import annotations

import subprocess
import tempfile
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


def _source_has_audio(source_path: str | Path) -> bool:
    command = [
        settings.ffprobe_binary,
        "-hide_banner",
        "-v",
        "error",
        "-select_streams",
        "a",
        "-show_entries",
        "stream=index",
        "-of",
        "csv=p=0",
        str(Path(source_path).resolve()),
    ]
    completed = subprocess.run(command, capture_output=True, text=True, check=False)
    return completed.returncode == 0 and bool(completed.stdout.strip())


def build_voiceover_copy(clip, story_package: ClipStoryPackage) -> str:
    lines: list[str] = []
    cue_texts = [cue.text for cue in story_package.caption_cues if cue.text]
    for candidate in [*cue_texts, clip.suggested_description, story_package.supporting_line, *story_package.analysis_outline]:
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


def _probe_audio_duration(audio_path: str | Path) -> float:
    command = [
        settings.ffprobe_binary,
        "-hide_banner",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(Path(audio_path).resolve()),
    ]
    completed = subprocess.run(command, capture_output=True, text=True, check=False)
    try:
        return float((completed.stdout or "0").strip())
    except ValueError:
        return 0.0


def _preferred_male_voices(text: str) -> list[str]:
    if any("가" <= char <= "힣" for char in text):
        return [
            "Eddy (한국어(대한민국))",
            "Grandpa (한국어(대한민국))",
        ]
    return [
        "Eddy (영어(미국))",
        "Daniel",
        "Eddy (영어(영국))",
    ]


def _build_atempo_filter(speed_ratio: float) -> str:
    safe_ratio = max(0.5, min(speed_ratio, 4.0))
    stages: list[str] = []
    while safe_ratio > 2.0:
        stages.append("atempo=2.0")
        safe_ratio /= 2.0
    while safe_ratio < 0.5:
        stages.append("atempo=0.5")
        safe_ratio /= 0.5
    stages.append(f"atempo={safe_ratio:.4f}")
    return ",".join(stages)


def _synthesize_voice_line(output_path: Path, copy: str, voices: list[str]) -> None:
    for voice in voices:
        command = ["say", "-v", voice, "-r", "176", "-o", str(output_path.resolve()), copy]
        try:
            _run_local_command(command, "Unable to synthesize local voiceover")
            return
        except HTTPException:
            continue

    fallback_command = ["say", "-r", "176", "-o", str(output_path.resolve()), copy]
    _run_local_command(fallback_command, "Unable to synthesize local voiceover")


def render_voiceover_audio(
    project_id: int,
    clip_id: int,
    base_name: str,
    voiceover_copy: str,
    *,
    subtitle_cues: list[dict] | None = None,
    clip_duration: float | None = None,
) -> Path:
    exports_dir = project_exports_dir(project_id)
    exports_dir.mkdir(parents=True, exist_ok=True)
    voices = _preferred_male_voices(voiceover_copy)
    if subtitle_cues and clip_duration and clip_duration > 0:
        output_path = exports_dir / f"{base_name}-tts.wav"
        with tempfile.TemporaryDirectory(prefix=f"raa-tts-{clip_id}-") as temp_dir:
            temp_root = Path(temp_dir)
            command = [
                settings.ffmpeg_binary,
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-f",
                "lavfi",
                "-t",
                f"{clip_duration:.3f}",
                "-i",
                "anullsrc=channel_layout=mono:sample_rate=44100",
            ]
            filter_parts = [f"[0:a]atrim=0:{clip_duration:.3f},asetpts=N/SR/TB[silence]"]
            mix_inputs = ["[silence]"]

            for index, cue in enumerate(subtitle_cues, start=1):
                text = " ".join((cue.get("text") or "").replace("\n", " ").split()).strip()
                if not text:
                    continue
                raw_path = temp_root / f"cue-{index}.aiff"
                processed_path = temp_root / f"cue-{index}.wav"
                _synthesize_voice_line(raw_path, text, voices)
                raw_duration = _probe_audio_duration(raw_path)
                target_duration = max(0.8, float(cue["end"]) - float(cue["start"]) - 0.04)
                audio_filters = ["aresample=44100"]
                if raw_duration > target_duration * 1.04 and raw_duration > 0:
                    audio_filters.append(_build_atempo_filter(raw_duration / target_duration))
                audio_filters.append(f"atrim=0:{target_duration:.3f}")
                audio_filters.append("asetpts=N/SR/TB")
                _run_local_command(
                    [
                        settings.ffmpeg_binary,
                        "-y",
                        "-hide_banner",
                        "-loglevel",
                        "error",
                        "-i",
                        str(raw_path.resolve()),
                        "-filter:a",
                        ",".join(audio_filters),
                        "-c:a",
                        "pcm_s16le",
                        str(processed_path.resolve()),
                    ],
                    "Unable to align local voiceover",
                )
                command.extend(["-i", str(processed_path.resolve())])
                delay = max(0, int(round(float(cue["start"]) * 1000)))
                filter_parts.append(
                    f"[{len(mix_inputs)}:a]atrim=0:{target_duration:.3f},asetpts=N/SR/TB,adelay={delay}:all=1,volume=1.0[a_tts_{index}]"
                )
                mix_inputs.append(f"[a_tts_{index}]")

            filter_parts.append(
                f"{''.join(mix_inputs)}amix=inputs={len(mix_inputs)}:dropout_transition=0:normalize=0,"
                f"atrim=0:{clip_duration:.3f},asetpts=N/SR/TB[aout]"
            )
            command.extend(
                [
                    "-filter_complex",
                    ";".join(filter_parts),
                    "-map",
                    "[aout]",
                    "-c:a",
                    "pcm_s16le",
                    str(output_path.resolve()),
                ]
            )
            _run_local_command(command, "Unable to synthesize aligned local voiceover")
        logger.info("Rendered aligned local TTS. project_id=%s clip_id=%s", project_id, clip_id)
        return output_path

    output_path = exports_dir / f"{base_name}-tts.aiff"
    _synthesize_voice_line(output_path, voiceover_copy, voices)
    logger.info("Rendered local TTS. project_id=%s clip_id=%s", project_id, clip_id)
    return output_path


def render_background_music(project_id: int, clip_id: int, base_name: str, duration: float) -> Path:
    exports_dir = project_exports_dir(project_id)
    exports_dir.mkdir(parents=True, exist_ok=True)
    output_path = exports_dir / f"{base_name}-bgm.wav"
    safe_duration = max(4.0, duration + 0.25)
    fade_out_start = max(safe_duration - 1.2, 0.0)
    filter_complex = (
        "[0:a]volume=0.012[a0];"
        "[1:a]volume=0.008[a1];"
        "[2:a]highpass=f=320,lowpass=f=1800,volume=0.005[a2];"
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


def render_mixed_short_audio(
    project_id: int,
    clip_id: int,
    base_name: str,
    *,
    source_video_path: str | Path,
    clip_start_time: float,
    clip_duration: float,
    narration_path: str | Path | None = None,
    background_music_path: str | Path | None = None,
) -> Path:
    exports_dir = project_exports_dir(project_id)
    exports_dir.mkdir(parents=True, exist_ok=True)
    output_path = exports_dir / f"{base_name}-mix.wav"
    resolved_source_volume = 0.05 if narration_path and Path(narration_path).exists() else source_audio_volume

    command = [
        settings.ffmpeg_binary,
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-t",
        f"{clip_duration:.3f}",
        "-i",
        "anullsrc=channel_layout=mono:sample_rate=44100",
    ]
    filter_parts = ["[0:a]atrim=0:{duration},asetpts=N/SR/TB[silence]".format(duration=clip_duration)]
    mix_inputs = ["[silence]"]
    input_index = 1

    if _source_has_audio(source_video_path):
        command.extend(
            [
                "-ss",
                f"{clip_start_time:.3f}",
                "-t",
                f"{clip_duration:.3f}",
                "-i",
                str(Path(source_video_path).resolve()),
            ]
        )
        filter_parts.append(
            f"[{input_index}:a]volume={resolved_source_volume:.2f},aresample=44100,atrim=0:{clip_duration:.3f},asetpts=N/SR/TB[a_src]"
        )
        mix_inputs.append("[a_src]")
        input_index += 1

    if narration_path and Path(narration_path).exists():
        command.extend(["-i", str(Path(narration_path).resolve())])
        filter_parts.append(
            f"[{input_index}:a]aresample=44100,atrim=0:{clip_duration:.3f},asetpts=N/SR/TB,volume=1.10[a_tts]"
        )
        mix_inputs.append("[a_tts]")
        input_index += 1

    if background_music_path and Path(background_music_path).exists():
        fade_out_start = max(clip_duration - 1.1, 0.0)
        command.extend(["-i", str(Path(background_music_path).resolve())])
        filter_parts.append(
            f"[{input_index}:a]aresample=44100,atrim=0:{clip_duration:.3f},asetpts=N/SR/TB,"
            f"volume=0.07,afade=t=in:st=0:d=0.8,afade=t=out:st={fade_out_start:.2f}:d=0.9[a_bgm]"
        )
        mix_inputs.append("[a_bgm]")

    filter_parts.append(
        f"{''.join(mix_inputs)}amix=inputs={len(mix_inputs)}:dropout_transition=0:normalize=0,"
        f"atrim=0:{clip_duration:.3f},asetpts=N/SR/TB[aout]"
    )

    command.extend(
        [
            "-filter_complex",
            ";".join(filter_parts),
            "-map",
            "[aout]",
            "-c:a",
            "pcm_s16le",
            str(output_path.resolve()),
        ]
    )
    _run_local_command(command, "Unable to render mixed short audio")
    logger.info("Rendered mixed short audio. project_id=%s clip_id=%s", project_id, clip_id)
    return output_path
