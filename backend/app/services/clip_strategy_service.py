from __future__ import annotations

import re
from dataclasses import dataclass

from app.services.content_profile_service import COMBAT_SPORTS_ANALYSIS_TERMS, COMBAT_SPORTS_FINISH_TERMS


FORMAT_LABELS = {
    "legend": "레전드형",
    "finish": "피니시형",
    "analysis": "분석형",
    "editorial": "에디토리얼형",
    "coach_note": "코치 노트형",
}


@dataclass
class ClipStrategy:
    recommended_format: str
    virality_label: str
    selection_reason: str
    selection_signals: list[str]
    timeline_label: str | None = None
    source_runtime_seconds: float | None = None


def _contains_any(text: str, terms: set[str] | list[str]) -> bool:
    lowered = text.lower()
    return any(term in lowered for term in terms)


def _normalized_text(*parts: str | None) -> str:
    return " ".join((part or "").strip() for part in parts if part).strip().lower()


def _infer_format(text: str, duration: float, score: float) -> str:
    if _contains_any(text, COMBAT_SPORTS_ANALYSIS_TERMS.union({"분석", "브레이크다운", "이유", "why", "how"})):
        return FORMAT_LABELS["coach_note"] if duration >= 18 else FORMAT_LABELS["analysis"]
    if _contains_any(text, COMBAT_SPORTS_FINISH_TERMS.union({"레전드", "끝났다", "one shot", "exact moment"})):
        return FORMAT_LABELS["finish"] if duration <= 18 else FORMAT_LABELS["legend"]
    if score >= 84 and duration <= 18:
        return FORMAT_LABELS["legend"]
    if duration >= 24:
        return FORMAT_LABELS["editorial"]
    return FORMAT_LABELS["analysis"]


def _timeline_label(start_time: float, end_time: float, runtime: float | None) -> str | None:
    if runtime is None or runtime <= 0:
        return None
    midpoint = (start_time + end_time) / 2
    ratio = midpoint / runtime
    if ratio < 0.2:
        return "초반"
    if ratio < 0.45:
        return "전개 구간"
    if ratio < 0.75:
        return "중반 핵심"
    return "후반 클라이맥스"


def build_clip_strategy(
    *,
    hook_text: str,
    suggested_title: str,
    suggested_description: str,
    suggested_hashtags: str,
    duration: float,
    score: float,
    start_time: float,
    end_time: float,
    source_runtime_seconds: float | None = None,
) -> ClipStrategy:
    normalized = _normalized_text(hook_text, suggested_title, suggested_description, suggested_hashtags)
    recommended_format = _infer_format(normalized, duration, score)

    selection_signals: list[str] = []
    if score >= 88:
        selection_signals.append("조회수 가능성 점수가 매우 높아 1차 검토 우선순위입니다")
    elif score >= 78:
        selection_signals.append("상위권 점수라 먼저 살펴볼 가치가 있습니다")
    else:
        selection_signals.append("보조 후보로 테스트할 만한 점수대입니다")

    if 10 <= duration <= 22:
        selection_signals.append("완주율이 잘 나오는 짧은 숏츠 길이에 가깝습니다")
    elif duration <= 28:
        selection_signals.append("스토리와 임팩트를 함께 담기 좋은 길이입니다")
    else:
        selection_signals.append("설명형 숏츠로 풀기 좋은 비교적 긴 구간입니다")

    if re.search(r"[!?]|왜|바로|결정적|레전드|exact|watch|look", hook_text.lower()):
        selection_signals.append("초반 3초 안에 훅으로 쓰기 좋은 문장이 잡혀 있습니다")

    if _contains_any(normalized, COMBAT_SPORTS_FINISH_TERMS):
        selection_signals.append("격투기에서 반응이 잘 나오는 피니시/결정적 장면 문맥이 있습니다")
    elif _contains_any(normalized, COMBAT_SPORTS_ANALYSIS_TERMS):
        selection_signals.append("해설형 또는 코치 노트형 포맷으로 풀 수 있는 분석 문맥이 있습니다")

    if source_runtime_seconds and source_runtime_seconds >= 1800 and duration <= 22:
        selection_signals.append("긴 원본에서 짧게 압축된 장면이라 컷 체감이 분명합니다")

    timeline = _timeline_label(start_time, end_time, source_runtime_seconds)
    if timeline:
        selection_signals.append(f"원본 {timeline}에서 건진 장면이라 후보군 간 분산이 좋습니다")

    selection_reason = " / ".join(selection_signals[:3])
    if score >= 88:
        virality_label = "강력 추천"
    elif score >= 78:
        virality_label = "우선 검토"
    else:
        virality_label = "보조 후보"

    return ClipStrategy(
        recommended_format=recommended_format,
        virality_label=virality_label,
        selection_reason=selection_reason,
        selection_signals=selection_signals[:4],
        timeline_label=timeline,
        source_runtime_seconds=source_runtime_seconds,
    )
