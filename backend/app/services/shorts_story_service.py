from __future__ import annotations

import re
from dataclasses import dataclass

from app.services.clip_strategy_service import FORMAT_LABELS, build_clip_strategy
from app.services.content_profile_service import (
    CONTENT_PROFILE_BASEBALL,
    CONTENT_PROFILE_COMBAT_SPORTS,
    CONTENT_PROFILE_FIGURE_SKATING,
    CONTENT_PROFILE_GENERAL,
    CONTENT_PROFILE_RACING,
    CONTENT_PROFILE_SOCCER,
    detect_content_profile_from_text,
    get_profile_label,
)


@dataclass(frozen=True)
class StoryCue:
    start: float
    end: float
    text: str


@dataclass(frozen=True)
class ClipStoryPackage:
    story_angle: str
    analysis_headline: str
    analysis_outline: list[str]
    title_treatment: str
    caption_treatment: str
    top_label: str
    style_variant: str
    accent_hex: str
    caption_cues: list[StoryCue]


PROFILE_STYLE_CONFIG = {
    CONTENT_PROFILE_COMBAT_SPORTS: {
        "title_treatment": "상단 마이크로 타이틀 + 레전드/기술 해설 헤드라인",
        "caption_treatment": "하단 키네틱 자막 + 타이밍별 기술 해설 3줄",
        "top_label": "LEGEND BREAKDOWN",
        "style_variant": "legend_breakdown",
        "accent_hex": "E6C56B",
        "story_angle": "레전드 움직임 분석",
    },
    CONTENT_PROFILE_SOCCER: {
        "title_treatment": "상단 마이크로 타이틀 + 전술 포인트 헤드라인",
        "caption_treatment": "하단 키네틱 자막 + 전개/전환/마무리 3단 해설",
        "top_label": "TACTICAL BREAKDOWN",
        "style_variant": "tactical_breakdown",
        "accent_hex": "57D9A3",
        "story_angle": "경기 흐름 분석",
    },
    CONTENT_PROFILE_RACING: {
        "title_treatment": "상단 마이크로 타이틀 + 추월/전략 헤드라인",
        "caption_treatment": "하단 키네틱 자막 + 라인/브레이킹/결과 3단 해설",
        "top_label": "RACE BREAKDOWN",
        "style_variant": "race_breakdown",
        "accent_hex": "FF8A5B",
        "story_angle": "레이스 전략 분석",
    },
    CONTENT_PROFILE_FIGURE_SKATING: {
        "title_treatment": "상단 마이크로 타이틀 + 프로그램 해설 헤드라인",
        "caption_treatment": "하단 키네틱 자막 + 진입/회전/랜딩 3단 해설",
        "top_label": "PROGRAM BREAKDOWN",
        "style_variant": "program_breakdown",
        "accent_hex": "79D5FF",
        "story_angle": "프로그램 디테일 분석",
    },
    CONTENT_PROFILE_BASEBALL: {
        "title_treatment": "상단 마이크로 타이틀 + 승부처 헤드라인",
        "caption_treatment": "하단 키네틱 자막 + 세팅/승부구/결과 3단 해설",
        "top_label": "PLAY BREAKDOWN",
        "style_variant": "play_breakdown",
        "accent_hex": "7FD36A",
        "story_angle": "결정적 승부 분석",
    },
    CONTENT_PROFILE_GENERAL: {
        "title_treatment": "상단 마이크로 타이틀 + 핵심 장면 헤드라인",
        "caption_treatment": "하단 키네틱 자막 + 장면 해설 3단 구성",
        "top_label": "STORY CUT",
        "style_variant": "story_breakdown",
        "accent_hex": "63D4F5",
        "story_angle": "핵심 장면 분석",
    },
}

SUBJECT_STOPWORDS = {
    "레전드",
    "전설",
    "하이라이트",
    "숏츠",
    "분석",
    "브레이크다운",
    "포인트",
    "장면",
    "움직임",
    "경기",
    "콤보",
    "기술",
    "타이밍",
    "Legend",
    "Breakdown",
    "Shorts",
}

KOREAN_TRAILING_TOKENS = {"왜", "어떻게", "레전드", "전설", "이유", "분석", "움직임", "장면", "포인트"}
KOREAN_TRAILING_PARTICLES = ("이", "가", "은", "는", "을", "를", "의")

COMBAT_TECHNIQUE_LIBRARY = [
    ({"peekaboo", "peek-a-boo", "피카부"}, "피카부 스텝으로 리듬을 먼저 흔든다"),
    ({"jab", "잽"}, "잽으로 시선과 가드를 먼저 묶는다"),
    ({"feint", "페인트"}, "페인트로 수비 반응을 먼저 꺼낸다"),
    ({"distance", "거리"}, "거리 싸움부터 주도권을 잡는다"),
    ({"angle", "각도", "pivot", "피벗"}, "피벗과 각도 전환으로 타점을 연다"),
    ({"slip", "roll", "weave", "헤드무브먼트"}, "헤드무브먼트로 카운터 타이밍을 만든다"),
    ({"hook", "훅"}, "측면 각도에서 훅을 짧게 연결한다"),
    ({"uppercut", "어퍼컷"}, "상대 중심이 뜨는 순간 어퍼컷을 꽂는다"),
    ({"bodyshot", "body shot", "바디샷"}, "바디샷으로 리듬을 한 번 끊어낸다"),
    ({"counter", "카운터"}, "상대가 반응하는 찰나에 카운터를 맞춘다"),
    ({"combo", "combination", "콤보", "연타"}, "열린 틈에 콤보를 끊기지 않게 연결한다"),
    ({"finish", "knockout", "ko", "피니시", "다운"}, "마지막 연타로 흐름을 완전히 끝낸다"),
]

PROFILE_FALLBACK_OUTLINES = {
    CONTENT_PROFILE_COMBAT_SPORTS: [
        "초반 움직임에서 먼저 리듬을 장악한다",
        "상대 반응을 끌어낸 뒤 콤보 진입 타이밍을 만든다",
        "마지막 연타로 흐름을 완전히 끊어낸다",
    ],
    CONTENT_PROFILE_SOCCER: [
        "첫 움직임에서 공간과 시선을 먼저 묶는다",
        "전환 구간에서 패턴 하나로 수비 라인을 흔든다",
        "마지막 선택이 결과를 바꾸는 장면으로 이어진다",
    ],
    CONTENT_PROFILE_RACING: [
        "초반 라인 선택으로 추월 각을 미리 만든다",
        "브레이킹 포인트에서 승부를 거는 타이밍이 나온다",
        "출구 가속을 살려 결과를 확정짓는다",
    ],
    CONTENT_PROFILE_FIGURE_SKATING: [
        "진입 자세에서 프로그램 리듬을 먼저 잡는다",
        "회전 구간에서 기술 완성도가 갈린다",
        "랜딩과 마무리 흐름이 인상을 결정한다",
    ],
    CONTENT_PROFILE_BASEBALL: [
        "카운트와 세팅부터 승부 흐름을 만든다",
        "결정구가 들어가는 순간 타이밍이 무너진다",
        "마지막 결과가 경기 흐름을 완전히 바꾼다",
    ],
    CONTENT_PROFILE_GENERAL: [
        "초반 장면이 시청자 시선을 먼저 붙잡는다",
        "중간 포인트에서 흐름이 분명하게 바뀐다",
        "마지막 장면이 이 클립의 이유를 설명한다",
    ],
}


def _normalized_text(*parts: str | None) -> str:
    return " ".join((part or "").strip() for part in parts if part).strip()


def _extract_subject(text: str) -> str | None:
    candidates = re.findall(r"[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}|[가-힣]{2,}(?:\s+[가-힣]{1,4}){0,2}", text)
    for raw in candidates:
        candidate = raw.strip()
        parts = [part for part in candidate.split() if part]
        while parts and parts[-1] in KOREAN_TRAILING_TOKENS:
            parts.pop()
        if parts and all("가" <= char <= "힣" for char in parts[-1]) and parts[-1].endswith(KOREAN_TRAILING_PARTICLES) and len(parts[-1]) > 2:
            parts[-1] = parts[-1][:-1]
        candidate = " ".join(parts) if parts else candidate
        collapsed = candidate.replace(" ", "")
        lowered = candidate.lower()
        if len(collapsed) < 3:
            continue
        if candidate in SUBJECT_STOPWORDS or collapsed in SUBJECT_STOPWORDS:
            continue
        if lowered in {word.lower() for word in SUBJECT_STOPWORDS}:
            continue
        if candidate.startswith("#"):
            continue
        return candidate
    return None


def _contains_any(text: str, terms: set[str]) -> bool:
    lowered = text.lower()
    return any(term in lowered for term in terms)


def _build_combat_outline(text: str) -> list[str]:
    lowered = text.lower()
    outline: list[str] = []
    for terms, copy in COMBAT_TECHNIQUE_LIBRARY:
        if any(term in lowered for term in terms) and copy not in outline:
            outline.append(copy)
        if len(outline) == 3:
            return outline

    for fallback in PROFILE_FALLBACK_OUTLINES[CONTENT_PROFILE_COMBAT_SPORTS]:
        if fallback not in outline:
            outline.append(fallback)
        if len(outline) == 3:
            break
    return outline[:3]


def _build_profile_outline(profile: str, text: str) -> list[str]:
    if profile == CONTENT_PROFILE_COMBAT_SPORTS:
        return _build_combat_outline(text)
    return PROFILE_FALLBACK_OUTLINES.get(profile, PROFILE_FALLBACK_OUTLINES[CONTENT_PROFILE_GENERAL])[:3]


def _resolve_headline(subject: str | None, profile: str, recommended_format: str, text: str) -> str:
    subject_prefix = f"{subject} " if subject else ""
    if profile == CONTENT_PROFILE_COMBAT_SPORTS:
        if "레전드" in text or recommended_format in {FORMAT_LABELS["legend"], FORMAT_LABELS["finish"]}:
            return f"{subject_prefix}왜 아직도 레전드로 불리는지".strip()
        if recommended_format in {FORMAT_LABELS["analysis"], FORMAT_LABELS["coach_note"]}:
            return f"{subject_prefix}움직임이 특별한 이유".strip()
        return f"{subject_prefix}콤보가 통하는 디테일".strip()
    if profile == CONTENT_PROFILE_SOCCER:
        return f"{subject_prefix}이 장면이 흐름을 바꾼 이유".strip()
    if profile == CONTENT_PROFILE_RACING:
        return f"{subject_prefix}이 랩이 갈린 진짜 이유".strip()
    if profile == CONTENT_PROFILE_FIGURE_SKATING:
        return f"{subject_prefix}이 프로그램이 살아나는 포인트".strip()
    if profile == CONTENT_PROFILE_BASEBALL:
        return f"{subject_prefix}이 승부가 갈린 포인트".strip()
    return f"{subject_prefix}이 장면을 다시 보게 되는 이유".strip()


def _build_cue_schedule(duration: float, outline: list[str], transcript_segments: list[dict]) -> list[StoryCue]:
    if not outline:
        return []
    if transcript_segments:
        anchors: list[tuple[float, float]] = []
        total = len(transcript_segments)
        indices = [0, max(0, total // 2 - 1), total - 1]
        for index in indices[: len(outline)]:
            segment = transcript_segments[index]
            start = max(0.35, float(segment["start"]))
            end = min(duration, max(start + 2.2, float(segment["end"]) + 0.7))
            anchors.append((start, end))
    else:
        anchors = []

    if not anchors:
        slot = max(2.6, min(4.8, duration / max(len(outline), 2)))
        positions = [0.65, max(1.4, duration * 0.34), max(2.1, duration * 0.66)]
        for position in positions[: len(outline)]:
            start = min(max(0.35, position), max(0.35, duration - 2.0))
            end = min(duration, start + slot)
            anchors.append((start, end))

    cues: list[StoryCue] = []
    for copy, (start, end) in zip(outline, anchors, strict=False):
        cues.append(StoryCue(start=round(start, 2), end=round(max(start + 1.9, end), 2), text=copy))
    return cues


def build_clip_story_package(
    *,
    hook_text: str,
    suggested_title: str,
    suggested_description: str,
    suggested_hashtags: str,
    duration: float,
    score: float,
    start_time: float,
    end_time: float,
    content_profile: str | None = None,
    source_runtime_seconds: float | None = None,
    transcript_segments: list[dict] | None = None,
) -> ClipStoryPackage:
    normalized = _normalized_text(hook_text, suggested_title, suggested_description, suggested_hashtags)
    resolved_profile = content_profile or detect_content_profile_from_text(normalized)
    strategy = build_clip_strategy(
        hook_text=hook_text,
        suggested_title=suggested_title,
        suggested_description=suggested_description,
        suggested_hashtags=suggested_hashtags,
        duration=duration,
        score=score,
        start_time=start_time,
        end_time=end_time,
        content_profile=resolved_profile,
        source_runtime_seconds=source_runtime_seconds,
    )
    style_config = PROFILE_STYLE_CONFIG.get(resolved_profile, PROFILE_STYLE_CONFIG[CONTENT_PROFILE_GENERAL])
    subject = _extract_subject(normalized)
    headline = _resolve_headline(subject, resolved_profile, strategy.recommended_format, normalized)
    outline = _build_profile_outline(resolved_profile, normalized)
    cues = _build_cue_schedule(duration, outline, transcript_segments or [])
    top_label = style_config["top_label"]
    if subject and resolved_profile == CONTENT_PROFILE_COMBAT_SPORTS:
        top_label = f"{subject.upper()} BREAKDOWN" if re.search(r"[A-Za-z]", subject) else f"{subject} 브레이크다운"

    return ClipStoryPackage(
        story_angle=style_config["story_angle"],
        analysis_headline=headline,
        analysis_outline=outline,
        title_treatment=style_config["title_treatment"],
        caption_treatment=style_config["caption_treatment"],
        top_label=top_label,
        style_variant=style_config["style_variant"],
        accent_hex=style_config["accent_hex"],
        caption_cues=cues,
    )


def build_story_package_from_clip(clip, transcript_segments: list[dict] | None = None, source_runtime_seconds: float | None = None) -> ClipStoryPackage:
    return build_clip_story_package(
        hook_text=clip.hook_text,
        suggested_title=clip.suggested_title,
        suggested_description=clip.suggested_description,
        suggested_hashtags=clip.suggested_hashtags,
        duration=clip.duration,
        score=clip.score,
        start_time=clip.start_time,
        end_time=clip.end_time,
        content_profile=detect_content_profile_from_text(_normalized_text(clip.hook_text, clip.suggested_title, clip.suggested_description, clip.suggested_hashtags)),
        source_runtime_seconds=source_runtime_seconds,
        transcript_segments=transcript_segments,
    )


def build_story_summary_line(clip) -> str:
    package = build_story_package_from_clip(clip)
    profile_label = get_profile_label(detect_content_profile_from_text(_normalized_text(clip.hook_text, clip.suggested_title, clip.suggested_description)))
    return f"{profile_label} · {package.story_angle} · {package.analysis_headline}"
