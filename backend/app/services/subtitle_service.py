import textwrap
from pathlib import Path

from app.core.constants import SUBTITLE_STYLE_MAP, SubtitlePreset
from app.models.clip_candidate import ClipCandidate
from app.models.transcript import Transcript
from app.services.transcription_service import load_transcript_segments
from app.utils.paths import project_exports_dir, to_relative_data_path


PRESET_WRAP_RULES = {
    SubtitlePreset.clean.value: {"line_length": 28, "max_chars": 54},
    SubtitlePreset.bold.value: {"line_length": 22, "max_chars": 44},
    SubtitlePreset.creator.value: {"line_length": 24, "max_chars": 48},
}


def _format_timestamp(seconds: float) -> str:
    milliseconds = int(round(seconds * 1000))
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    secs, ms = divmod(remainder, 1_000)
    return f"{hours:02}:{minutes:02}:{secs:02},{ms:03}"


def _wrap_text(text: str, max_line_length: int = 26, max_lines: int = 2) -> str:
    normalized = " ".join(text.split())
    if not normalized:
        return ""
    if " " not in normalized and len(normalized) > max_line_length:
        chunks = [normalized[i : i + max_line_length] for i in range(0, len(normalized), max_line_length)]
        return "\n".join(chunks[:max_lines])
    wrapped = textwrap.wrap(normalized, width=max_line_length, break_long_words=False, break_on_hyphens=False)
    if len(wrapped) > max_lines:
        clipped = wrapped[:max_lines]
        clipped[-1] = clipped[-1][: max(0, max_line_length - 3)].rstrip() + "..."
        return "\n".join(clipped)
    return "\n".join(wrapped[:max_lines])


def build_subtitle_style(preset: str) -> str:
    return SUBTITLE_STYLE_MAP.get(preset, SUBTITLE_STYLE_MAP[SubtitlePreset.clean.value])


def extract_clip_transcript_segments(clip: ClipCandidate, transcript: Transcript) -> list[dict]:
    segments = load_transcript_segments(transcript)
    clip_segments: list[dict] = []
    for segment in segments:
        if segment["end"] <= clip.start_time or segment["start"] >= clip.end_time:
            continue
        clip_segments.append(
            {
                "start": max(segment["start"], clip.start_time) - clip.start_time,
                "end": min(segment["end"], clip.end_time) - clip.start_time,
                "text": " ".join(segment["text"].split()),
            }
        )

    if clip_segments:
        return clip_segments
    return [{"start": 0.0, "end": min(clip.duration, 3.0), "text": clip.hook_text or clip.suggested_title}]


def _merge_segments(segments: list[dict], preset: str) -> list[dict]:
    rules = PRESET_WRAP_RULES.get(preset, PRESET_WRAP_RULES[SubtitlePreset.clean.value])
    merged: list[dict] = []
    current: dict | None = None
    for segment in segments:
        text = " ".join(segment["text"].split())
        if not text:
            continue
        if current is None:
            current = {"start": segment["start"], "end": segment["end"], "text": text}
            continue
        gap = segment["start"] - current["end"]
        proposed_text = f"{current['text']} {text}"
        if gap <= 0.45 and len(proposed_text) <= rules["max_chars"] and segment["end"] - current["start"] <= 4.2:
            current["end"] = segment["end"]
            current["text"] = proposed_text
            if current["text"].rstrip().endswith((".", "!", "?", "다", "요")):
                merged.append(current)
                current = None
        else:
            merged.append(current)
            current = {"start": segment["start"], "end": segment["end"], "text": text}
    if current is not None:
        merged.append(current)
    return merged


def write_clip_srt(project_id: int, clip: ClipCandidate, transcript: Transcript, base_name: str | None = None) -> tuple[Path, str]:
    clip_segments = extract_clip_transcript_segments(clip, transcript)
    merged_segments = _merge_segments(clip_segments, clip.subtitle_preset)
    rules = PRESET_WRAP_RULES.get(clip.subtitle_preset, PRESET_WRAP_RULES[SubtitlePreset.clean.value])

    exports_dir = project_exports_dir(project_id)
    exports_dir.mkdir(parents=True, exist_ok=True)
    srt_stem = base_name or f"clip_{clip.id}_subtitles"
    srt_path = exports_dir / f"{srt_stem}.srt"
    lines: list[str] = []
    for index, segment in enumerate(merged_segments, start=1):
        wrapped_text = _wrap_text(segment["text"], max_line_length=rules["line_length"])
        if not wrapped_text:
            continue
        end_time = max(segment["end"], segment["start"] + 1.0)
        lines.extend(
            [
                str(index),
                f"{_format_timestamp(segment['start'])} --> {_format_timestamp(end_time)}",
                wrapped_text,
                "",
            ]
        )
    srt_path.write_text("\n".join(lines).strip() + "\n", encoding="utf-8")
    return srt_path, to_relative_data_path(srt_path)
