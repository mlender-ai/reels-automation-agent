import re
from dataclasses import dataclass

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.constants import (
    ClipStatus,
    COMPARISON_KEYWORDS,
    EMOTION_KEYWORDS,
    FILLER_PREFIXES,
    HOOK_KEYWORDS,
    ProjectStatus,
    SubtitlePreset,
)
from app.models.clip_candidate import ClipCandidate
from app.models.project import Project
from app.models.transcript import Transcript
from app.services.metadata_generation_service import DEFAULT_METADATA_GENERATOR
from app.services.transcription_service import load_transcript_segments
from app.services.validation_service import ensure_transcript_segments_available, normalize_transcript_segments, validate_clip_window


@dataclass
class CandidateWindow:
    start_time: float
    end_time: float
    duration: float
    segments: list[dict]
    score: float = 0.0
    hook_text: str = ""
    suggested_title: str = ""
    suggested_description: str = ""
    suggested_hashtags: str = ""


def _window_text(window_segments: list[dict]) -> str:
    return " ".join(segment["text"] for segment in window_segments).strip()


def _contains_keywords(text: str, keywords: list[str]) -> int:
    lowered = text.lower()
    return sum(1 for keyword in keywords if keyword.lower() in lowered)


def _estimate_density(window_segments: list[dict], duration: float) -> float:
    if duration <= 0:
        return 0
    word_count = sum(len(segment["text"].split()) for segment in window_segments)
    return word_count / duration


def _max_gap(window_segments: list[dict]) -> float:
    return max((current["start"] - previous["end"] for previous, current in zip(window_segments, window_segments[1:])), default=0.0)


def _starts_with_filler(text: str) -> bool:
    lowered = text.strip().lower()
    return any(lowered.startswith(prefix.lower()) for prefixes in FILLER_PREFIXES.values() for prefix in prefixes)


def _looks_like_mid_sentence(text: str) -> bool:
    stripped = text.strip().lower()
    if not stripped:
        return True
    return any(
        stripped.startswith(prefix)
        for prefix in (
            "and ",
            "but ",
            "so ",
            "because ",
            "then ",
            "그래서",
            "근데",
            "그리고",
            "하지만",
            "왜냐하면",
        )
    )


def _has_clean_start(previous_segment: dict | None, current_segment: dict) -> bool:
    if previous_segment is None:
        return True
    previous_text = previous_segment["text"].strip()
    gap = current_segment["start"] - previous_segment["end"]
    return gap > 0.55 or previous_text.endswith((".", "!", "?", "다", "요"))


def _has_clean_end(last_segment: dict, next_segment: dict | None) -> bool:
    ending_text = last_segment["text"].strip()
    if ending_text.endswith((".", "!", "?", "다", "요")):
        return True
    if next_segment is None:
        return True
    gap = next_segment["start"] - last_segment["end"]
    return gap > 0.6


def _hook_strength(window_segments: list[dict], start_time: float) -> float:
    opening_segments = [segment for segment in window_segments if segment["start"] - start_time <= 3.0]
    opening_text = " ".join(segment["text"] for segment in opening_segments)
    keywords = HOOK_KEYWORDS["en"] + HOOK_KEYWORDS["ko"]
    emphasis = EMOTION_KEYWORDS["en"] + EMOTION_KEYWORDS["ko"]
    score = _contains_keywords(opening_text, keywords) * 4.5
    score += _contains_keywords(opening_text, emphasis) * 2.0
    if any(mark in opening_text for mark in ["?", "!", ":"]):
        score += 2.5
    return score


def score_candidate_window(
    segments: list[dict],
    start_index: int,
    end_index: int,
) -> float:
    window_segments = segments[start_index : end_index + 1]
    duration = window_segments[-1]["end"] - window_segments[0]["start"]
    if duration <= 0:
        return 0.0

    text = _window_text(window_segments)
    density = _estimate_density(window_segments, duration)
    previous_segment = segments[start_index - 1] if start_index > 0 else None
    next_segment = segments[end_index + 1] if end_index + 1 < len(segments) else None
    clean_start = _has_clean_start(previous_segment, window_segments[0])
    clean_end = _has_clean_end(window_segments[-1], next_segment)

    duration_score = max(0.0, 25 - abs(32 - duration) * 0.9)
    density_score = min(18.0, density * 2.2)
    hook_score = _hook_strength(window_segments, window_segments[0]["start"])
    emotion_score = _contains_keywords(text, EMOTION_KEYWORDS["en"] + EMOTION_KEYWORDS["ko"]) * 2.5
    comparison_score = _contains_keywords(text, COMPARISON_KEYWORDS["en"] + COMPARISON_KEYWORDS["ko"]) * 2.2
    list_score = len(re.findall(r"\b\d+\b|1위|2위|3위|첫|둘|셋|top|비교|차이|핵심|결정적", text.lower())) * 2.1
    gap_penalty = max(0.0, _max_gap(window_segments) - 0.85) * 9
    start_penalty = 7 if not clean_start else 0
    end_penalty = 6 if not clean_end else 0
    filler_penalty = 5 if _starts_with_filler(window_segments[0]["text"]) else 0
    mid_sentence_penalty = 4 if _looks_like_mid_sentence(window_segments[0]["text"]) else 0
    density_penalty = 10 if density < 2.2 else 0

    score = duration_score + density_score + hook_score + emotion_score + comparison_score + list_score
    score -= gap_penalty + start_penalty + end_penalty + filler_penalty + mid_sentence_penalty + density_penalty
    return round(max(score, 0.0), 3)


def _iter_candidate_windows(segments: list[dict]) -> list[CandidateWindow]:
    windows: list[CandidateWindow] = []
    total_runtime = segments[-1]["end"] - segments[0]["start"]
    preferred_targets = [20, 24, 28, 32, 36, 40, 45]
    fallback_targets = [16, 18] if total_runtime <= 24 else []
    for start_index, segment in enumerate(segments):
        start_time = float(segment["start"])
        for target in preferred_targets + fallback_targets:
            window_segments: list[dict] = []
            end_index = start_index
            for candidate_index, probe in enumerate(segments[start_index:], start=start_index):
                duration = probe["end"] - start_time
                if duration > 45:
                    break
                window_segments.append(probe)
                end_index = candidate_index
                if duration >= target:
                    break
            if not window_segments:
                continue
            duration = window_segments[-1]["end"] - start_time
            if 20 <= duration <= 45 or (duration >= 15 and segments[-1]["end"] <= 22):
                windows.append(
                    CandidateWindow(
                        start_time=round(start_time, 3),
                        end_time=round(window_segments[-1]["end"], 3),
                        duration=round(duration, 3),
                        segments=window_segments,
                        score=score_candidate_window(segments, start_index, end_index),
                    )
                )
    return windows


def _iou(candidate: CandidateWindow, accepted: CandidateWindow) -> float:
    intersection = max(0.0, min(candidate.end_time, accepted.end_time) - max(candidate.start_time, accepted.start_time))
    union = max(candidate.end_time, accepted.end_time) - min(candidate.start_time, accepted.start_time)
    return intersection / union if union else 0.0


def _deduplicate(windows: list[CandidateWindow]) -> list[CandidateWindow]:
    selected: list[CandidateWindow] = []
    seen_bounds: set[tuple[float, float]] = set()
    for candidate in sorted(windows, key=lambda item: item.score, reverse=True):
        bounds = (round(candidate.start_time, 1), round(candidate.end_time, 1))
        if bounds in seen_bounds:
            continue
        if all(_iou(candidate, accepted) < 0.58 for accepted in selected):
            selected.append(candidate)
            seen_bounds.add(bounds)
        if len(selected) == 5:
            break
    return selected


def _build_candidates(windows: list[CandidateWindow]) -> list[CandidateWindow]:
    for window in windows:
        window_text = _window_text(window.segments)
        metadata = DEFAULT_METADATA_GENERATOR.generate(window.segments, window_text)
        window.hook_text = metadata.hook_text
        window.suggested_title = metadata.suggested_title
        window.suggested_description = metadata.suggested_description
        window.suggested_hashtags = metadata.suggested_hashtags
    meaningful = [window for window in windows if window.score > 0]
    selected = _deduplicate(meaningful)
    if len(selected) < 3:
        fallback = [window for window in sorted(windows, key=lambda item: item.score, reverse=True) if window not in selected]
        selected.extend(fallback[: 3 - len(selected)])
    return selected[:5]


def generate_ranked_candidate_windows(raw_segments: list[dict]) -> list[CandidateWindow]:
    segments = normalize_transcript_segments(raw_segments)
    ensure_transcript_segments_available(segments)
    windows = _iter_candidate_windows(segments)
    if not windows:
        raise HTTPException(status_code=422, detail="Transcript does not contain enough speech to produce clip candidates")

    top_windows = _build_candidates(windows)
    if not top_windows:
        raise HTTPException(status_code=422, detail="Unable to score useful clip candidates from the transcript")

    max_source_duration = max(segment["end"] for segment in segments)
    validated: list[CandidateWindow] = []
    seen_bounds: set[tuple[float, float]] = set()
    for window in top_windows:
        try:
            window.duration = validate_clip_window(window.start_time, window.end_time, max_source_duration=max_source_duration)
        except HTTPException:
            continue
        bounds = (round(window.start_time, 1), round(window.end_time, 1))
        if bounds in seen_bounds:
            continue
        seen_bounds.add(bounds)
        validated.append(window)

    if not validated:
        raise HTTPException(
            status_code=422,
            detail="Unable to produce valid clip windows from the current transcript. Try retranscribing or upload a clearer source video.",
        )
    return validated


def generate_clip_candidates(db: Session, project: Project, transcript: Transcript) -> list[ClipCandidate]:
    top_windows = generate_ranked_candidate_windows(load_transcript_segments(transcript))

    existing_clips = db.scalars(select(ClipCandidate).where(ClipCandidate.project_id == project.id)).all()
    for clip in existing_clips:
        db.delete(clip)
    db.flush()

    created: list[ClipCandidate] = []
    for window in top_windows:
        candidate = ClipCandidate(
            project_id=project.id,
            start_time=window.start_time,
            end_time=window.end_time,
            duration=window.duration,
            score=window.score,
            hook_text=window.hook_text,
            suggested_title=window.suggested_title,
            suggested_description=window.suggested_description,
            suggested_hashtags=window.suggested_hashtags,
            subtitle_preset=SubtitlePreset.clean.value,
            status=ClipStatus.pending.value,
        )
        db.add(candidate)
        created.append(candidate)

    project.status = ProjectStatus.ready_for_review.value
    db.add(project)
    db.commit()
    for clip in created:
        db.refresh(clip)
    return created
