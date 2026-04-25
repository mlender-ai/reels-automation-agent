from __future__ import annotations

from dataclasses import asdict, dataclass

from app.services.clip_strategy_service import build_clip_strategy
from app.services.content_profile_service import (
    CONTENT_PROFILE_BASEBALL,
    CONTENT_PROFILE_COMBAT_SPORTS,
    CONTENT_PROFILE_FIGURE_SKATING,
    CONTENT_PROFILE_GENERAL,
    CONTENT_PROFILE_RACING,
    CONTENT_PROFILE_SOCCER,
    SPORT_CONTENT_PROFILES,
    detect_content_profile_from_text,
    get_profile_label,
    profile_signal_score,
)
from app.services.shorts_story_service import build_story_package_from_clip, resolve_story_profile


@dataclass(frozen=True)
class ShortformFormatVariant:
    id: str
    label: str
    summary: str
    visual_direction: str
    edit_rhythm: str
    sample_title: str
    sample_caption: str
    search_prompt: str
    source_clip_id: int
    source_clip_range: str
    confidence_label: str


@dataclass(frozen=True)
class ShortformScriptIdea:
    id: str
    label: str
    format_label: str
    title: str
    hook: str
    opening_line: str
    beat_plan: list[str]
    closing_line: str
    cta: str
    hashtags: str
    why_it_can_work: str
    source_clip_id: int
    source_clip_range: str


@dataclass(frozen=True)
class ProjectCreativeStrategy:
    project_id: int
    strategy_focus: str
    format_variants: list[ShortformFormatVariant]
    script_ideas: list[ShortformScriptIdea]


PROFILE_SEARCH_HINTS = {
    CONTENT_PROFILE_COMBAT_SPORTS: "타이슨 복싱",
    CONTENT_PROFILE_SOCCER: "축구 레전드 플레이",
    CONTENT_PROFILE_RACING: "레이싱 추월 장면",
    CONTENT_PROFILE_FIGURE_SKATING: "피겨 레전드 프로그램",
    CONTENT_PROFILE_BASEBALL: "야구 결정적 장면",
    CONTENT_PROFILE_GENERAL: "레전드 장면",
}

PROFILE_SCRIPT_TEMPLATES = {
    CONTENT_PROFILE_COMBAT_SPORTS: [
        ("legend", "레전드 해설형", "왜 아직도 이 장면이 돈다는지", "0-2초 훅 / 2-7초 셋업 / 7-13초 피니시"),
        ("reaction", "반응 밈형", "왜 건드리면 안 되는지", "0-1초 상황 자막 / 1-6초 충돌 / 6-12초 펀치라인"),
        ("countdown", "카운트다운형", "무서운 이유 3가지", "0-2초 문제 제기 / 2-10초 3포인트 / 10초 이후 결론"),
        ("breakdown", "기술 분석형", "이 무브가 계속 보이는 이유", "0-2초 제목 / 2-6초 포인트1 / 6-12초 포인트2"),
    ],
    CONTENT_PROFILE_SOCCER: [
        ("legend", "역전 서사형", "왜 이 장면에서 흐름이 바뀌는지", "0-2초 훅 / 2-8초 패턴 / 8-14초 결과"),
        ("reaction", "팬 반응형", "이 장면에서 다들 소리 지르는 이유", "0-1초 반응 / 1-6초 전개 / 6-12초 폭발"),
        ("countdown", "포인트 3개형", "이 플레이가 먹힌 이유 3가지", "0-2초 훅 / 2-10초 3포인트 / 10초 이후 결론"),
        ("breakdown", "전술 분석형", "수비가 여기서 무너진 이유", "0-2초 제목 / 2-7초 장면 / 7-13초 결론"),
    ],
    CONTENT_PROFILE_RACING: [
        ("legend", "추월 서사형", "왜 여기서 승부가 갈렸는지", "0-2초 훅 / 2-8초 브레이킹 / 8-14초 결과"),
        ("reaction", "반응 밈형", "여기서 다들 놀라는 이유", "0-1초 반응 / 1-6초 장면 / 6-12초 펀치라인"),
        ("countdown", "포인트 3개형", "추월이 성공한 이유 3가지", "0-2초 훅 / 2-10초 포인트 / 10초 이후 결론"),
        ("breakdown", "라인 분석형", "라인 선택이 미쳤던 이유", "0-2초 제목 / 2-7초 진입 / 7-13초 탈출"),
    ],
    CONTENT_PROFILE_FIGURE_SKATING: [
        ("legend", "프로그램 서사형", "왜 이 장면에서 감탄이 터지는지", "0-2초 훅 / 2-8초 진입 / 8-14초 랜딩"),
        ("reaction", "감정 반응형", "이 장면에서 분위기 바뀌는 이유", "0-1초 감정 자막 / 1-6초 전개 / 6-12초 피크"),
        ("countdown", "포인트 3개형", "프로그램이 살아나는 이유 3가지", "0-2초 훅 / 2-10초 포인트 / 10초 이후 결론"),
        ("breakdown", "기술 분석형", "점수가 붙는 이유가 여기 있음", "0-2초 제목 / 2-7초 포인트 / 7-13초 정리"),
    ],
    CONTENT_PROFILE_BASEBALL: [
        ("legend", "승부 서사형", "왜 이 한 공에 분위기가 넘어가는지", "0-2초 훅 / 2-8초 승부 / 8-14초 결과"),
        ("reaction", "반응 밈형", "이 장면에서 벤치가 들썩이는 이유", "0-1초 반응 / 1-6초 승부 / 6-12초 펀치라인"),
        ("countdown", "포인트 3개형", "이 공이 먹히는 이유 3가지", "0-2초 훅 / 2-10초 포인트 / 10초 이후 결론"),
        ("breakdown", "구종 분석형", "타이밍이 무너지는 이유", "0-2초 제목 / 2-7초 구종 / 7-13초 결과"),
    ],
    CONTENT_PROFILE_GENERAL: [
        ("legend", "헤드라인형", "왜 이 장면이 계속 도는지", "0-2초 훅 / 2-8초 전개 / 8-14초 결론"),
        ("reaction", "반응형", "다시 보게 되는 이유", "0-1초 반응 / 1-6초 전개 / 6-12초 펀치라인"),
        ("countdown", "포인트 3개형", "이 장면 포인트 3가지", "0-2초 훅 / 2-10초 포인트 / 10초 이후 결론"),
        ("breakdown", "분석형", "한 번에 이해되는 이유", "0-2초 제목 / 2-7초 포인트 / 7-13초 정리"),
    ],
}


def _normalize_copy(text: str | None, fallback: str) -> str:
    normalized = " ".join((text or "").split()).strip() or fallback
    replacements = [
        ("입니다", ""),
        ("입니다.", ""),
        ("합니다", ""),
        ("합니다.", ""),
        ("하는 이유", "이유"),
        ("보이는 이유", "이유"),
        ("설명", ""),
        ("분석", ""),
    ]
    for source, target in replacements:
        normalized = normalized.replace(source, target)
    normalized = normalized.strip(" .!?")
    return normalized or fallback


def _compact_title(text: str | None, fallback: str) -> str:
    copy = _normalize_copy(text, fallback)
    if len(copy) <= 26:
        return copy
    trimmed = copy[:26].rstrip()
    if " " in trimmed:
        trimmed = trimmed.rsplit(" ", 1)[0].rstrip()
    return trimmed or copy[:26].rstrip()


def _format_time(seconds: float) -> str:
    total = max(0, int(round(seconds)))
    minutes, remain = divmod(total, 60)
    return f"{minutes}:{remain:02d}"


def _clip_range_label(clip) -> str:
    return f"{_format_time(clip.start_time)}-{_format_time(clip.end_time)}"


def _majority_profile(clips: list) -> str:
    counts: dict[str, int] = {}
    for clip in clips:
        key = _resolve_clip_profile(clip)
        counts[key] = counts.get(key, 0) + 1
    return max(counts.items(), key=lambda item: item[1])[0] if counts else CONTENT_PROFILE_GENERAL


def _resolve_clip_profile(clip) -> str:
    combined_text = " ".join(
        [
            getattr(clip, "hook_text", ""),
            getattr(clip, "suggested_title", ""),
            getattr(clip, "suggested_description", ""),
            getattr(clip, "suggested_hashtags", ""),
        ]
    )
    resolved = resolve_story_profile(
        getattr(clip, "hook_text", ""),
        getattr(clip, "suggested_title", ""),
        getattr(clip, "suggested_description", ""),
        getattr(clip, "suggested_hashtags", ""),
    )
    if resolved != CONTENT_PROFILE_GENERAL:
        return resolved
    detected = detect_content_profile_from_text(combined_text)
    if detected != CONTENT_PROFILE_GENERAL:
        return detected
    profile_scores = {profile: profile_signal_score(combined_text, profile) for profile in SPORT_CONTENT_PROFILES}
    best_profile = max(profile_scores, key=profile_scores.get, default=CONTENT_PROFILE_GENERAL)
    return best_profile if profile_scores.get(best_profile, 0) > 0 else CONTENT_PROFILE_GENERAL


def _resolve_clip_strategy(clip):
    profile = _resolve_clip_profile(clip)
    return build_clip_strategy(
        hook_text=getattr(clip, "hook_text", ""),
        suggested_title=getattr(clip, "suggested_title", ""),
        suggested_description=getattr(clip, "suggested_description", ""),
        suggested_hashtags=getattr(clip, "suggested_hashtags", ""),
        duration=getattr(clip, "duration", 0.0),
        score=getattr(clip, "score", 0.0),
        start_time=getattr(clip, "start_time", 0.0),
        end_time=getattr(clip, "end_time", 0.0),
        content_profile=profile,
        source_runtime_seconds=None,
    )


def _build_strategy_focus(profile: str, top_clip) -> str:
    profile_label = get_profile_label(profile)
    hook = _compact_title(getattr(top_clip, "hook_text", None), getattr(top_clip, "suggested_title", "첫 장면에서 바로 잡아야 합니다"))
    if profile == CONTENT_PROFILE_COMBAT_SPORTS:
        return f"{profile_label}는 큰 고정 제목, 짧은 반응 자막, 12~18초 길이가 가장 자연스럽습니다. 이번 프로젝트는 '{hook}' 톤으로 먼저 밀어보는 편이 좋습니다."
    if profile == CONTENT_PROFILE_SOCCER:
        return f"{profile_label}는 흐름 반전과 결과를 빠르게 보여주는 편이 좋습니다. 이번 프로젝트는 '{hook}' 같은 역전형 훅이 먼저 먹힐 가능성이 높습니다."
    if profile == CONTENT_PROFILE_RACING:
        return f"{profile_label}는 한 번에 승부가 갈리는 지점을 먼저 보여줘야 합니다. 이번 프로젝트는 '{hook}' 같은 추월형 훅이 강합니다."
    if profile == CONTENT_PROFILE_FIGURE_SKATING:
        return f"{profile_label}는 진입과 랜딩을 짧게 묶는 구성이 잘 맞습니다. 이번 프로젝트는 '{hook}'처럼 감탄 포인트를 앞에 두는 편이 좋습니다."
    if profile == CONTENT_PROFILE_BASEBALL:
        return f"{profile_label}는 승부 한 공과 표정 변화를 같이 보여줘야 합니다. 이번 프로젝트는 '{hook}' 같은 승부형 훅이 잘 맞습니다."
    return f"이번 프로젝트는 '{hook}' 같은 큰 제목 훅과 짧은 자막 중심으로 가는 편이 가장 안정적입니다."


def _format_variant_label(variant_id: str, profile: str) -> str:
    if variant_id == "legend":
        return "빅 헤드라인형"
    if variant_id == "reaction":
        return "반응 밈형"
    if variant_id == "countdown":
        return "카운트다운형"
    if profile == CONTENT_PROFILE_COMBAT_SPORTS and variant_id == "breakdown":
        return "콤보 분석형"
    return "포인트 분석형"


def _build_variant_summary(variant_id: str, profile_label: str) -> str:
    if variant_id == "legend":
        return f"{profile_label}에서 가장 세게 먹히는 장면을 큰 고정 제목 하나로 밀어붙이는 포맷"
    if variant_id == "reaction":
        return "짧은 상황 자막과 한 줄 반응으로 밈처럼 소비되게 만드는 포맷"
    if variant_id == "countdown":
        return "이유 3가지, 포인트 3개처럼 반복 소비에 강한 구성"
    return "한 동작 또는 한 포인트를 짧게 풀어주는 설명형 포맷"


def _build_visual_direction(variant_id: str) -> str:
    if variant_id == "legend":
        return "상단 큰 2줄 제목 고정, 하단 자막은 1줄만 짧게 사용"
    if variant_id == "reaction":
        return "상단 헤드라인 + 중간 반응 자막 + 하단 한 줄 펀치라인"
    if variant_id == "countdown":
        return "고정 제목 아래 숫자 포인트를 짧게 1, 2, 3으로 넘기는 구성"
    return "고정 제목은 유지하고 자막은 포인트가 바뀔 때만 짧게 치는 구성"


def _build_sample_title(variant_id: str, clip, package) -> str:
    if variant_id == "countdown":
        return _compact_title(f"{package.analysis_headline} 3가지 이유", package.analysis_headline)
    if variant_id == "reaction":
        return _compact_title(f"{package.analysis_headline} 왜 이러냐", package.analysis_headline)
    if variant_id == "breakdown":
        first_outline = package.analysis_outline[0] if package.analysis_outline else package.analysis_headline
        return _compact_title(first_outline, package.analysis_headline)
    return _compact_title(package.analysis_headline, clip.suggested_title)


def _build_sample_caption(variant_id: str, package) -> str:
    if variant_id == "reaction":
        return f"({package.supporting_line.strip('!')})"
    if variant_id == "countdown":
        return package.analysis_outline[0] if package.analysis_outline else package.supporting_line
    return _compact_title(package.supporting_line, package.analysis_headline)


def _build_search_prompt(profile: str, clip) -> str:
    hint = PROFILE_SEARCH_HINTS.get(profile, PROFILE_SEARCH_HINTS[CONTENT_PROFILE_GENERAL])
    title = _compact_title(getattr(clip, "suggested_title", None), hint).replace(" ", "")
    if len(title) >= 6:
        return f'검색 "{title}"'
    return f'검색 "{hint}"'


def _build_edit_rhythm(rhythm: str, clip) -> str:
    return f"{rhythm} / 권장 길이 {max(9, int(round(clip.duration)))}초 안팎"


def _build_format_variants(clips: list, profile: str) -> list[ShortformFormatVariant]:
    templates = PROFILE_SCRIPT_TEMPLATES.get(profile, PROFILE_SCRIPT_TEMPLATES[CONTENT_PROFILE_GENERAL])
    profile_label = get_profile_label(profile)
    variants: list[ShortformFormatVariant] = []
    for index, (variant_id, _, _, rhythm) in enumerate(templates[:4]):
        clip = clips[index % len(clips)]
        package = build_story_package_from_clip(clip)
        strategy = _resolve_clip_strategy(clip)
        variants.append(
            ShortformFormatVariant(
                id=variant_id,
                label=_format_variant_label(variant_id, profile),
                summary=_build_variant_summary(variant_id, profile_label),
                visual_direction=_build_visual_direction(variant_id),
                edit_rhythm=_build_edit_rhythm(rhythm, clip),
                sample_title=_build_sample_title(variant_id, clip, package),
                sample_caption=_build_sample_caption(variant_id, package),
                search_prompt=_build_search_prompt(profile, clip),
                source_clip_id=clip.id,
                source_clip_range=_clip_range_label(clip),
                confidence_label=strategy.virality_label,
            )
        )
    return variants


def _build_script_idea_copy(variant_id: str, clip, package) -> tuple[str, str, str, list[str], str]:
    if variant_id == "countdown":
        title = _compact_title(f"{package.analysis_headline} 3가지 이유", package.analysis_headline)
        hook = f"이 장면이 계속 도는 이유, 딱 세 가지로 끝냅니다."
        opening_line = f"첫 번째는 {package.analysis_outline[0] if package.analysis_outline else package.supporting_line}"
        beat_plan = [
            "0-2초: 이유 3가지로 끝낸다고 선언",
            f"2-6초: 1번 포인트 - {package.analysis_outline[0] if package.analysis_outline else package.supporting_line}",
            f"6-12초: 2, 3번 포인트 - {' / '.join(package.analysis_outline[1:3]) if len(package.analysis_outline) > 1 else package.supporting_line}",
        ]
        closing_line = "결국 이 장면은 한 번에 설득이 됩니다."
        return title, hook, opening_line, beat_plan, closing_line
    if variant_id == "reaction":
        title = _compact_title(f"{package.analysis_headline} 왜 이러냐", package.analysis_headline)
        hook = f"{package.supporting_line.strip('!')} 이 반응이 먼저 나옵니다."
        opening_line = f"처음 보는 사람도 여기서 바로 반응합니다."
        beat_plan = [
            "0-1초: 짧은 상황극 자막",
            f"1-6초: 핵심 장면 노출 - {package.analysis_headline}",
            f"6-12초: 반응 자막으로 마무리 - {package.supporting_line}",
        ]
        closing_line = "그래서 짧게 잘라도 기억에 남습니다."
        return title, hook, opening_line, beat_plan, closing_line
    if variant_id == "breakdown":
        title = _compact_title(package.analysis_headline, clip.suggested_title)
        hook = f"{package.analysis_outline[0] if package.analysis_outline else package.supporting_line}, 여기서 이미 흐름이 갈립니다."
        opening_line = f"처음 한 동작부터 상대 반응이 달라집니다."
        beat_plan = [
            f"0-2초: 제목 고정 - {package.analysis_headline}",
            f"2-7초: 포인트 1 - {package.analysis_outline[0] if package.analysis_outline else package.supporting_line}",
            f"7-13초: 포인트 2, 3 - {' / '.join(package.analysis_outline[1:3]) if len(package.analysis_outline) > 1 else package.supporting_line}",
        ]
        closing_line = "한 동작씩 보면 더 무섭게 보입니다."
        return title, hook, opening_line, beat_plan, closing_line

    title = _compact_title(package.analysis_headline, clip.suggested_title)
    hook = f"{package.supporting_line.strip('!')}, 이 한 줄로 충분합니다."
    opening_line = "처음 2초 안에 큰 제목부터 박고 갑니다."
    beat_plan = [
        f"0-2초: 고정 헤드라인 - {package.analysis_headline}",
        f"2-7초: 장면 전개 - {package.supporting_line}",
        f"7-13초: 마지막 장면으로 확정 - {package.analysis_outline[-1] if package.analysis_outline else package.supporting_line}",
    ]
    closing_line = "긴 설명보다 이 구성이 더 빨리 먹힙니다."
    return title, hook, opening_line, beat_plan, closing_line


def _build_script_ideas(clips: list, profile: str) -> list[ShortformScriptIdea]:
    templates = PROFILE_SCRIPT_TEMPLATES.get(profile, PROFILE_SCRIPT_TEMPLATES[CONTENT_PROFILE_GENERAL])
    ideas: list[ShortformScriptIdea] = []
    for index, (variant_id, label, why_angle, _) in enumerate(templates):
        clip = clips[index % len(clips)]
        package = build_story_package_from_clip(clip)
        title, hook, opening_line, beat_plan, closing_line = _build_script_idea_copy(variant_id, clip, package)
        ideas.append(
            ShortformScriptIdea(
                id=f"{variant_id}-{clip.id}",
                label=label,
                format_label=_format_variant_label(variant_id, profile),
                title=title,
                hook=hook,
                opening_line=opening_line,
                beat_plan=beat_plan,
                closing_line=closing_line,
                cta="마지막 장면까지 보게 만드는 흐름으로 정리",
                hashtags=getattr(clip, "suggested_hashtags", ""),
                why_it_can_work=f"{why_angle} / {getattr(clip, 'selection_reason', '')}".strip(" /"),
                source_clip_id=clip.id,
                source_clip_range=_clip_range_label(clip),
            )
        )
        if len(ideas) == 6:
            break
    return ideas


def build_project_creative_strategy(project, clips: list) -> ProjectCreativeStrategy:
    ranked_clips = sorted(clips, key=lambda candidate: (candidate.score, -candidate.duration), reverse=True)
    if not ranked_clips:
        return ProjectCreativeStrategy(
            project_id=project.id,
            strategy_focus="아직 클립 후보가 없어 포맷 전략을 만들 수 없습니다. 먼저 자막 추출과 후보 생성을 실행해 주세요.",
            format_variants=[],
            script_ideas=[],
        )

    focus_profile = _majority_profile(ranked_clips[:5])
    top_clips = ranked_clips[: max(3, min(5, len(ranked_clips)))]
    return ProjectCreativeStrategy(
        project_id=project.id,
        strategy_focus=_build_strategy_focus(focus_profile, top_clips[0]),
        format_variants=_build_format_variants(top_clips, focus_profile),
        script_ideas=_build_script_ideas(top_clips, focus_profile),
    )


def serialize_project_creative_strategy(strategy: ProjectCreativeStrategy) -> dict:
    return {
        "project_id": strategy.project_id,
        "strategy_focus": strategy.strategy_focus,
        "format_variants": [asdict(variant) for variant in strategy.format_variants],
        "script_ideas": [asdict(idea) for idea in strategy.script_ideas],
    }
