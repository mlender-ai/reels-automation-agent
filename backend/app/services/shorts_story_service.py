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
    supporting_line: str
    analysis_outline: list[str]
    title_treatment: str
    caption_treatment: str
    top_label: str
    style_variant: str
    accent_hex: str
    caption_cues: list[StoryCue]


PROFILE_STYLE_CONFIG = {
    CONTENT_PROFILE_COMBAT_SPORTS: {
        "title_treatment": "초반 2초 오프닝 훅",
        "caption_treatment": "미사용",
        "top_label": "",
        "style_variant": "legend_breakdown",
        "accent_hex": "FFFFFF",
        "story_angle": "오프닝 훅",
    },
    CONTENT_PROFILE_SOCCER: {
        "title_treatment": "초반 2초 오프닝 훅",
        "caption_treatment": "미사용",
        "top_label": "",
        "style_variant": "tactical_breakdown",
        "accent_hex": "FFFFFF",
        "story_angle": "오프닝 훅",
    },
    CONTENT_PROFILE_RACING: {
        "title_treatment": "초반 2초 오프닝 훅",
        "caption_treatment": "미사용",
        "top_label": "",
        "style_variant": "race_breakdown",
        "accent_hex": "FFFFFF",
        "story_angle": "오프닝 훅",
    },
    CONTENT_PROFILE_FIGURE_SKATING: {
        "title_treatment": "초반 2초 오프닝 훅",
        "caption_treatment": "미사용",
        "top_label": "",
        "style_variant": "program_breakdown",
        "accent_hex": "FFFFFF",
        "story_angle": "오프닝 훅",
    },
    CONTENT_PROFILE_BASEBALL: {
        "title_treatment": "초반 2초 오프닝 훅",
        "caption_treatment": "미사용",
        "top_label": "",
        "style_variant": "play_breakdown",
        "accent_hex": "FFFFFF",
        "story_angle": "오프닝 훅",
    },
    CONTENT_PROFILE_GENERAL: {
        "title_treatment": "초반 2초 오프닝 훅",
        "caption_treatment": "미사용",
        "top_label": "",
        "style_variant": "story_breakdown",
        "accent_hex": "FFFFFF",
        "story_angle": "오프닝 훅",
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
    "바로",
    "다시",
    "계속",
    "보이는지",
    "무브",
    "Legend",
    "Breakdown",
    "Shorts",
}

KOREAN_TRAILING_TOKENS = {"왜", "어떻게", "레전드", "전설", "이유", "분석", "움직임", "장면", "포인트"}
KOREAN_TRAILING_PARTICLES = ("이", "가", "은", "는", "을", "를", "의", "로", "으로")

COMBAT_TECHNIQUE_LIBRARY = [
    ({"peekaboo", "peek-a-boo", "피카부"}, "피카부 스텝으로 리듬 먼저 먹음"),
    ({"jab", "잽"}, "잽으로 시선 먼저 묶음"),
    ({"feint", "페인트"}, "페인트로 반응 먼저 빼냄"),
    ({"distance", "거리"}, "거리부터 이미 주도권 잡음"),
    ({"angle", "각도", "pivot", "피벗"}, "피벗으로 각도 열어버림"),
    ({"slip", "roll", "weave", "헤드무브먼트"}, "헤드무브로 카운터 타이밍 만듦"),
    ({"hook", "훅"}, "짧은 훅이 옆각에서 바로 들어감"),
    ({"uppercut", "어퍼컷"}, "중심 뜨는 순간 어퍼컷 연결"),
    ({"bodyshot", "body shot", "바디샷"}, "바디샷으로 리듬 한 번 끊음"),
    ({"counter", "카운터"}, "반응 나오는 순간 카운터 꽂힘"),
    ({"combo", "combination", "콤보", "연타"}, "빈틈 열리자 콤보 바로 들어감"),
    ({"finish", "knockout", "ko", "피니시", "다운"}, "마지막 연타로 흐름 끝냄"),
]

COMBAT_QUOTE_PATTERNS = [
    (("see what i want to see", "see what i want"), "원하는 걸 보기 전엔 안 멈춘다"),
    (("go to sleep", "sleep in the dirt", "sleep in dirt"), "상대가 쓰러지는 장면만 본다"),
    (("permanently", "being hurt", "hurt for me"), "끝날 때까지 계속 몰아붙인다"),
    (("can't be", "must we breathe", "breathe out"), "끝까지 압박해서 흐름을 뺏는다"),
]

PROFILE_FALLBACK_OUTLINES = {
    CONTENT_PROFILE_COMBAT_SPORTS: [
        "초반 리듬부터 먹음",
        "반응 나오자 바로 들어감",
        "마지막 연타로 끝냄",
    ],
    CONTENT_PROFILE_SOCCER: [
        "첫 움직임에서 공간 열림",
        "전환 한 번에 수비 흔들림",
        "마지막 선택이 결과 바꿈",
    ],
    CONTENT_PROFILE_RACING: [
        "라인 선택부터 승부 봄",
        "브레이킹에서 추월 각 만듦",
        "출구 가속으로 결과 확정",
    ],
    CONTENT_PROFILE_FIGURE_SKATING: [
        "진입부터 리듬 잡힘",
        "회전 구간에서 완성도 갈림",
        "랜딩 하나로 인상 정리됨",
    ],
    CONTENT_PROFILE_BASEBALL: [
        "카운트부터 흐름 만듦",
        "결정구 들어가며 타이밍 무너짐",
        "마지막 결과로 분위기 뒤집힘",
    ],
    CONTENT_PROFILE_GENERAL: [
        "첫 장면부터 눈길 잡음",
        "중간부터 흐름 확 바뀜",
        "마지막 장면에서 이유 나옴",
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
        if " " not in candidate and all("가" <= char <= "힣" for char in collapsed):
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


def _should_use_subject(subject: str | None) -> bool:
    if not subject:
        return False
    if re.search(r"[A-Z][a-z]+", subject):
        return True
    parts = [part for part in subject.split() if part]
    if len(parts) != 2:
        return False
    return all(2 <= len(part) <= 5 for part in parts)


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


def _build_combat_quote_outline(transcript_segments: list[dict]) -> list[str]:
    transcript_text = " ".join(" ".join((segment.get("text") or "").split()) for segment in transcript_segments).lower()
    outline: list[str] = []
    for phrases, copy in COMBAT_QUOTE_PATTERNS:
        if any(phrase in transcript_text for phrase in phrases) and copy not in outline:
            outline.append(copy)
    return outline[:3]


def _build_profile_outline(profile: str, text: str) -> list[str]:
    if profile == CONTENT_PROFILE_COMBAT_SPORTS:
        return _build_combat_outline(text)
    return PROFILE_FALLBACK_OUTLINES.get(profile, PROFILE_FALLBACK_OUTLINES[CONTENT_PROFILE_GENERAL])[:3]


def _build_transcript_outline(profile: str, transcript_segments: list[dict] | None, fallback_text: str) -> list[str]:
    if not transcript_segments:
        return _build_profile_outline(profile, fallback_text)
    if profile == CONTENT_PROFILE_COMBAT_SPORTS:
        quote_outline = _build_combat_quote_outline(transcript_segments)
        if quote_outline:
            while len(quote_outline) < 3:
                fallback = PROFILE_FALLBACK_OUTLINES[CONTENT_PROFILE_COMBAT_SPORTS][len(quote_outline)]
                if fallback not in quote_outline:
                    quote_outline.append(fallback)
            return quote_outline[:3]
    return _build_profile_outline(profile, fallback_text)


def _compact_korean_copy(text: str, fallback: str) -> str:
    normalized = " ".join((text or "").split()).strip()
    if not normalized:
        normalized = fallback
    normalized = normalized.split(".")[0].split("!")[0].split("?")[0].strip()
    replacements = [
        ("장면입니다", ""),
        ("장면이다", ""),
        ("이유입니다", "이유"),
        ("입니다", ""),
        ("이다", ""),
        ("합니다", ""),
        ("하는 순간", "터지는 순간"),
        ("열립니다", "열림"),
        ("넘어갑니다", "넘어감"),
        ("먹습니다", "먹음"),
    ]
    for source, target in replacements:
        normalized = normalized.replace(source, target)
    normalized = normalized.strip(" .,!?\n\t")
    if len(normalized) > 22:
        normalized = normalized[:22].rstrip()
    if normalized and not normalized.endswith(("!", "?")):
        normalized = f"{normalized}!"
    return normalized or fallback


def _resolve_headline(subject: str | None, profile: str, recommended_format: str, text: str) -> str:
    resolved_subject = subject if _should_use_subject(subject) else None
    subject_prefix = f"{resolved_subject} " if resolved_subject else ""
    if profile == CONTENT_PROFILE_COMBAT_SPORTS:
        if "레전드" in text or recommended_format in {FORMAT_LABELS["legend"], FORMAT_LABELS["finish"]}:
            return f"{subject_prefix}전성기, 이 장면이면 끝".strip()
        if recommended_format in {FORMAT_LABELS["analysis"], FORMAT_LABELS["coach_note"]}:
            return f"{subject_prefix}이 무브가 아직도 무서움".strip()
        return f"{subject_prefix}콤보 각이 열리는 순간".strip()
    if profile == CONTENT_PROFILE_SOCCER:
        return f"{subject_prefix}흐름 바뀌는 장면".strip()
    if profile == CONTENT_PROFILE_RACING:
        return f"{subject_prefix}여기서 승부 갈림".strip()
    if profile == CONTENT_PROFILE_FIGURE_SKATING:
        return f"{subject_prefix}프로그램 살아나는 순간".strip()
    if profile == CONTENT_PROFILE_BASEBALL:
        return f"{subject_prefix}승부 갈린 한 장면".strip()
    return f"{subject_prefix}이 장면만 계속 돌려보게 됨".strip()


def _resolve_supporting_line(profile: str, suggested_description: str, hook_text: str, outline: list[str]) -> str:
    fallback = outline[0] if outline else "지금 분위기 완전히 바뀜!"
    base = suggested_description or hook_text or fallback
    compact = _compact_korean_copy(base, fallback)
    compact = compact.replace("완성함!", "이유 나옴!").replace("완성함", "이유 나옴")
    compact = compact.replace("선언!", "한마디!").replace("선언", "한마디")
    compact = compact.replace("절대 물러서지 않는", "안 물러나는")
    compact = compact.replace("절대 안", "안")
    compact = compact.replace("원하는 장면이 나올 때까지", "원하는 장면 나올 때까지")
    compact = compact.replace("절대 물러서지", "절대 안 멈춤")
    compact = compact.replace("선언입니다", "한마디다")
    compact = compact.replace("선언", "한마디")
    if profile == CONTENT_PROFILE_COMBAT_SPORTS and len(compact) < 10:
        return f"{compact.rstrip('!?')} 바로 터짐!"
    return compact


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
    gap = 0.18
    minimum_span = 2.15
    maximum_span = 4.2
    previous_end = 0.35
    for index, (copy, (start, end)) in enumerate(zip(outline, anchors, strict=False)):
        safe_start = max(start, previous_end + gap)
        safe_end = max(safe_start + minimum_span, end)
        if index < len(anchors) - 1:
            next_anchor_start = anchors[index + 1][0]
            safe_end = min(safe_end, max(safe_start + 1.6, next_anchor_start - gap))
        safe_end = min(safe_end, safe_start + maximum_span)
        safe_end = min(duration - 0.1, safe_end)
        if safe_end <= safe_start:
            safe_end = min(duration - 0.1, safe_start + 1.8)
        cues.append(StoryCue(start=round(safe_start, 2), end=round(safe_end, 2), text=copy))
        previous_end = safe_end
    return cues


def resolve_story_profile(*parts: str, transcript_segments: list[dict] | None = None, explicit_profile: str | None = None) -> str:
    if explicit_profile:
        return explicit_profile
    base_text = _normalized_text(*parts)
    transcript_text = " ".join(segment.get("text", "").strip() for segment in (transcript_segments or []) if segment.get("text"))
    combined = _normalized_text(base_text, transcript_text)
    transcript_profile = detect_content_profile_from_text(transcript_text) if transcript_text else CONTENT_PROFILE_GENERAL
    combined_profile = detect_content_profile_from_text(combined)
    base_profile = detect_content_profile_from_text(base_text)
    if transcript_profile != CONTENT_PROFILE_GENERAL:
        return transcript_profile
    if combined_profile != CONTENT_PROFILE_GENERAL:
        return combined_profile
    return base_profile


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
    resolved_profile = resolve_story_profile(
        hook_text,
        suggested_title,
        suggested_description,
        suggested_hashtags,
        transcript_segments=transcript_segments,
        explicit_profile=content_profile,
    )
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
    cleaned_title = " ".join((suggested_title or "").split()).strip()
    blocked_title_terms = ("분석", "브레이크다운", "포인트", "설명", "이유")
    if 6 <= len(cleaned_title) <= 24 and not any(term in cleaned_title for term in blocked_title_terms):
        headline = cleaned_title
    else:
        headline = _resolve_headline(subject, resolved_profile, strategy.recommended_format, normalized)
    base_outline = _build_transcript_outline(resolved_profile, transcript_segments, normalized)
    outline = list(base_outline)
    supporting_line = _resolve_supporting_line(resolved_profile, suggested_description, hook_text, outline)
    if supporting_line and all(supporting_line != line for line in outline):
        outline = [supporting_line, *outline[:2]]
    if resolved_profile == CONTENT_PROFILE_COMBAT_SPORTS and base_outline:
        transcript_headline = base_outline[0]
        if len(transcript_headline) <= 20:
            headline = transcript_headline
    cues = _build_cue_schedule(duration, outline, transcript_segments or [])
    top_label = style_config["top_label"]

    return ClipStoryPackage(
        story_angle=style_config["story_angle"],
        analysis_headline=headline,
        supporting_line=supporting_line,
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
        content_profile=resolve_story_profile(
            clip.hook_text,
            clip.suggested_title,
            clip.suggested_description,
            clip.suggested_hashtags,
            transcript_segments=transcript_segments,
        ),
        source_runtime_seconds=source_runtime_seconds,
        transcript_segments=transcript_segments,
    )


def build_story_summary_line(clip) -> str:
    package = build_story_package_from_clip(clip)
    profile_label = get_profile_label(detect_content_profile_from_text(_normalized_text(clip.hook_text, clip.suggested_title, clip.suggested_description)))
    return f"{profile_label} · {package.story_angle} · {package.analysis_headline}"
