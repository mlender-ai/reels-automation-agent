import textwrap
from pathlib import Path

from app.core.constants import SUBTITLE_STYLE_MAP, SubtitlePreset
from app.models.clip_candidate import ClipCandidate
from app.models.transcript import Transcript
from app.services.shorts_story_service import ClipStoryPackage
from app.services.transcription_service import load_transcript_segments
from app.utils.paths import project_exports_dir, to_relative_data_path


PRESET_WRAP_RULES = {
    SubtitlePreset.clean.value: {"line_length": 18, "max_chars": 34},
    SubtitlePreset.bold.value: {"line_length": 16, "max_chars": 30},
    SubtitlePreset.creator.value: {"line_length": 17, "max_chars": 32},
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


def build_display_subtitle_segments(clip: ClipCandidate, transcript: Transcript) -> list[dict]:
    clip_segments = extract_clip_transcript_segments(clip, transcript)
    rules = PRESET_WRAP_RULES.get(clip.subtitle_preset, PRESET_WRAP_RULES[SubtitlePreset.clean.value])
    merged: list[dict] = []
    current: dict | None = None

    for segment in clip_segments:
        text = " ".join(segment["text"].split())
        if not text:
            continue

        if current is None:
            current = {"start": segment["start"], "end": segment["end"], "text": text}
            continue

        gap = segment["start"] - current["end"]
        proposed = f"{current['text']} {text}"
        should_merge = (
            gap <= 0.18
            and len(proposed) <= max(22, rules["max_chars"] - 6)
            and segment["end"] - current["start"] <= 2.8
            and len(current["text"]) <= 18
        )

        if should_merge:
            current["end"] = segment["end"]
            current["text"] = proposed
        else:
            merged.append(current)
            current = {"start": segment["start"], "end": segment["end"], "text": text}

    if current is not None:
        merged.append(current)

    return merged or [{"start": 0.2, "end": min(clip.duration, 2.6), "text": clip.hook_text or clip.suggested_title}]


def build_story_subtitle_segments(clip: ClipCandidate, story_package: ClipStoryPackage) -> list[dict]:
    rules = PRESET_WRAP_RULES.get(clip.subtitle_preset, PRESET_WRAP_RULES[SubtitlePreset.clean.value])
    segments: list[dict] = []
    previous_text = ""

    for cue in story_package.caption_cues[:5]:
        normalized = " ".join((cue.text or "").split()).strip()
        if not normalized or normalized == previous_text:
            continue
        wrapped = _wrap_text(normalized, max_line_length=min(12, rules["line_length"]), max_lines=2)
        if not wrapped:
            continue
        start_time = max(0.05, float(cue.start))
        preferred_span = min(4.0, max(1.6, len(normalized) * 0.17))
        end_time = min(
            max(start_time + 1.2, min(float(cue.end), start_time + preferred_span)),
            max(clip.duration - 0.05, start_time + 1.2),
        )
        segments.append(
            {
                "start": round(start_time, 2),
                "end": round(end_time, 2),
                "text": wrapped,
            }
        )
        previous_text = normalized

    if segments:
        return segments

    fallback = story_package.supporting_line or story_package.analysis_headline or clip.suggested_title
    return [
        {
            "start": 0.35,
            "end": min(max(clip.duration - 0.2, 1.7), 2.8),
            "text": _wrap_text(fallback, max_line_length=14, max_lines=2),
        }
    ]


def write_clip_srt(project_id: int, clip: ClipCandidate, transcript: Transcript, base_name: str | None = None) -> tuple[Path, str]:
    display_segments = build_display_subtitle_segments(clip, transcript)
    rules = PRESET_WRAP_RULES.get(clip.subtitle_preset, PRESET_WRAP_RULES[SubtitlePreset.clean.value])

    exports_dir = project_exports_dir(project_id)
    exports_dir.mkdir(parents=True, exist_ok=True)
    srt_stem = base_name or f"clip_{clip.id}_subtitles"
    srt_path = exports_dir / f"{srt_stem}.srt"
    lines: list[str] = []
    for index, segment in enumerate(display_segments, start=1):
        wrapped_text = _wrap_text(segment["text"], max_line_length=rules["line_length"])
        if not wrapped_text:
            continue
        end_time = max(segment["end"], segment["start"] + 1.1)
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


def write_story_srt(
    project_id: int,
    clip: ClipCandidate,
    story_package: ClipStoryPackage,
    base_name: str | None = None,
) -> tuple[Path, str]:
    story_segments = build_story_subtitle_segments(clip, story_package)

    exports_dir = project_exports_dir(project_id)
    exports_dir.mkdir(parents=True, exist_ok=True)
    srt_stem = base_name or f"clip_{clip.id}_subtitles"
    srt_path = exports_dir / f"{srt_stem}.srt"
    lines: list[str] = []

    for index, segment in enumerate(story_segments, start=1):
        lines.extend(
            [
                str(index),
                f"{_format_timestamp(segment['start'])} --> {_format_timestamp(segment['end'])}",
                segment["text"],
                "",
            ]
        )

    srt_path.write_text("\n".join(lines).strip() + "\n", encoding="utf-8")
    return srt_path, to_relative_data_path(srt_path)


def build_subtitle_overlay_cues(clip: ClipCandidate, transcript: Transcript) -> list[dict]:
    display_segments = build_display_subtitle_segments(clip, transcript)
    cues: list[dict] = []
    previous_end = 0.0
    rules = PRESET_WRAP_RULES.get(clip.subtitle_preset, PRESET_WRAP_RULES[SubtitlePreset.clean.value])
    selected_segments = display_segments[:8]

    for segment in selected_segments:
        wrapped_text = _wrap_text(segment["text"], max_line_length=min(16, rules["line_length"]), max_lines=2)
        if not wrapped_text:
            continue
        start_time = max(segment["start"], previous_end + 0.03)
        end_time = max(segment["end"], start_time + 1.1)
        end_time = min(clip.duration - 0.05, end_time)
        cues.append({"start": round(start_time, 2), "end": round(end_time, 2), "text": wrapped_text})
        previous_end = end_time
    return cues


def build_story_overlay_cues(clip: ClipCandidate, story_package: ClipStoryPackage) -> list[dict]:
    return build_story_subtitle_segments(clip, story_package)
