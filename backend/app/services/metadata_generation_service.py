import re
from abc import ABC, abstractmethod
from collections import Counter
from dataclasses import dataclass

from app.services.content_profile_service import (
    CONTENT_PROFILE_BASEBALL,
    CONTENT_PROFILE_COMBAT_SPORTS,
    CONTENT_PROFILE_FIGURE_SKATING,
    CONTENT_PROFILE_RACING,
    CONTENT_PROFILE_SOCCER,
    PROFILE_ANALYSIS_TERMS,
    PROFILE_CLIMAX_TERMS,
    detect_content_profile_from_text,
)


STOPWORDS = {
    "the",
    "a",
    "an",
    "and",
    "are",
    "is",
    "it",
    "its",
    "if",
    "to",
    "in",
    "at",
    "of",
    "for",
    "on",
    "that",
    "this",
    "these",
    "with",
    "from",
    "your",
    "you",
    "his",
    "her",
    "him",
    "their",
    "them",
    "have",
    "what",
    "why",
    "when",
    "then",
    "into",
    "before",
    "after",
    "again",
    "only",
    "one",
    "over",
    "off",
    "under",
    "here",
    "there",
    "just",
    "fast",
    "slow",
    "right",
    "left",
    "down",
    "lands",
    "land",
    "look",
    "now",
    "about",
    "really",
    "not",
    "first",
    "last",
    "same",
    "real",
    "time",
    "key",
    "wins",
    "because",
    "but",
    "영상",
    "이거",
    "그거",
    "이제",
    "정말",
    "그리고",
    "하지만",
    "그러면",
    "manny",
    "pacquiao",
    "ao",
}

GENERIC_KEYWORDS = {
    "moment",
    "sequence",
    "video",
    "short",
    "clip",
}

GENERIC_PROPER_NAMES = {
    "Round",
    "Fight",
    "Corner",
    "Coach",
    "Referee",
    "Champion",
    "Match",
    "Race",
}

PROFILE_SUFFIX_KEYWORDS = {
    CONTENT_PROFILE_COMBAT_SPORTS: {"knockout", "counter", "jab", "submission", "headkick", "bodyshot"},
    CONTENT_PROFILE_SOCCER: {"goal", "header", "freekick", "assist", "winner", "save"},
    CONTENT_PROFILE_RACING: {"overtake", "pole", "pitstop", "lastlap", "safetycar", "win"},
    CONTENT_PROFILE_FIGURE_SKATING: {"quad", "axel", "spin", "landing", "program", "pcs"},
    CONTENT_PROFILE_BASEBALL: {"homer", "homerun", "walkoff", "strikeout", "doubleplay", "slider"},
}

PROFILE_BASE_TAGS = {
    CONTENT_PROFILE_COMBAT_SPORTS: ["#숏츠", "#복싱", "#격투기", "#shorts", "#boxing", "#fight"],
    CONTENT_PROFILE_SOCCER: ["#숏츠", "#축구", "#soccer", "#football", "#shorts", "#sports"],
    CONTENT_PROFILE_RACING: ["#숏츠", "#레이싱", "#motorsport", "#racing", "#shorts", "#sports"],
    CONTENT_PROFILE_FIGURE_SKATING: ["#숏츠", "#피겨", "#figureskating", "#iceskating", "#shorts", "#sports"],
    CONTENT_PROFILE_BASEBALL: ["#숏츠", "#야구", "#baseball", "#shorts", "#sports", "#highlight"],
}

PROFILE_COPY = {
    CONTENT_PROFILE_COMBAT_SPORTS: {
        "impact_title": "가드 열리는 순간 바로 끝났다",
        "analysis_title": "이 장면이 레전드인 이유",
        "fallback_title": "이 템포 하나가 진짜 레전드다",
        "impact_desc": "결정적인 진입과 마무리만 남겨서, 쇼츠에서 바로 터지는 구간으로 압축한 클립입니다.",
        "analysis_desc": "세팅, 타이밍, 마무리가 한 번에 읽히도록 전개를 짧고 강하게 묶었습니다.",
        "fallback_desc": "분위기가 뒤집히는 한 장면만 남겨서 반복 재생이 잘 되는 격투기 숏츠 톤으로 정리했습니다.",
        "short_hook": "이 장면이 진짜 레전드다",
    },
    CONTENT_PROFILE_SOCCER: {
        "impact_title": "후반 추가시간에 경기 뒤집혔다",
        "analysis_title": "이 장면이 경기 흐름을 바꿨다",
        "fallback_title": "이 패턴 하나가 결국 골로 이어졌다",
        "impact_desc": "골, 선방, 마지막 패스처럼 반응이 바로 오는 장면만 남겨서 짧고 강하게 정리한 축구 숏츠입니다.",
        "analysis_desc": "빌드업과 전환 포인트가 바로 읽히도록 핵심 장면만 압축해 전술형 숏츠 톤으로 묶었습니다.",
        "fallback_desc": "경기 리듬이 바뀌는 한 장면만 남겨서 반복 시청이 잘 되는 축구 하이라이트 클립으로 정리했습니다.",
        "short_hook": "이 한 장면이 경기 바꿨다",
    },
    CONTENT_PROFILE_RACING: {
        "impact_title": "마지막 랩에서 판이 뒤집혔다",
        "analysis_title": "이 장면이 레이스를 갈랐다",
        "fallback_title": "이 추월 하나로 분위기가 바뀌었다",
        "impact_desc": "추월, 피트, 마지막 랩처럼 반응이 바로 오는 장면만 남겨서 레이싱 숏츠에 맞게 속도감 있게 정리했습니다.",
        "analysis_desc": "전략과 라인이 한 번에 읽히도록 핵심 랩만 압축해서 레이스 분석형 숏츠로 정리했습니다.",
        "fallback_desc": "레이스 흐름이 바뀌는 포인트만 남겨서 짧게 몰입되는 레이싱 하이라이트 톤으로 묶었습니다.",
        "short_hook": "이 랩에서 레이스 끝났다",
    },
    CONTENT_PROFILE_FIGURE_SKATING: {
        "impact_title": "클린 랜딩 하나로 분위기가 바뀌었다",
        "analysis_title": "이 프로그램이 살아난 이유",
        "fallback_title": "이 연결 동작이 점수를 끌어올렸다",
        "impact_desc": "클린 랜딩과 포인트가 터지는 장면만 남겨서 짧고 우아한 피겨 숏츠 톤으로 압축했습니다.",
        "analysis_desc": "점프 진입, 회전, 구성 포인트가 읽히도록 기술적인 핵심만 남긴 피겨 분석형 클립입니다.",
        "fallback_desc": "프로그램의 분위기가 살아나는 순간만 남겨서 반복 재생이 잘 되는 피겨 하이라이트로 정리했습니다.",
        "short_hook": "이 랜딩 하나가 분위기 바꿨다",
    },
    CONTENT_PROFILE_BASEBALL: {
        "impact_title": "이 타석 하나로 경기 끝났다",
        "analysis_title": "이 수비가 흐름을 바꿨다",
        "fallback_title": "이 장면 하나가 야구를 뒤집었다",
        "impact_desc": "홈런, 끝내기, 삼진처럼 바로 반응이 오는 장면만 남겨서 짧게 터지는 야구 숏츠로 압축했습니다.",
        "analysis_desc": "볼배합과 타이밍 포인트가 읽히도록 핵심 장면만 남긴 야구 분석형 클립입니다.",
        "fallback_desc": "이닝 흐름이 바뀌는 장면만 남겨서 짧고 강하게 소비되는 야구 하이라이트로 정리했습니다.",
        "short_hook": "이 한 장면이 경기 끝냈다",
    },
}


@dataclass
class ClipMetadata:
    hook_text: str
    suggested_title: str
    suggested_description: str
    suggested_hashtags: str


class ClipMetadataGenerator(ABC):
    @abstractmethod
    def generate(self, window_segments: list[dict], window_text: str, *, content_profile: str | None = None) -> ClipMetadata:
        raise NotImplementedError


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _extract_keywords(text: str, limit: int = 5) -> list[str]:
    tokens = re.findall(r"[0-9A-Za-z가-힣]{2,}", text.lower())
    counter = Counter(token for token in tokens if token not in STOPWORDS and not token.isdigit())
    return [token for token, _ in counter.most_common(limit)]


def _extract_proper_names(text: str, limit: int = 3) -> list[str]:
    matches = re.findall(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b", text)
    cleaned: list[str] = []
    for match in matches:
        normalized = match.strip()
        if normalized in GENERIC_PROPER_NAMES:
            continue
        if normalized not in cleaned:
            cleaned.append(normalized)
        if len(cleaned) == limit:
            break
    return cleaned


def _contains_korean(text: str) -> bool:
    return bool(re.search(r"[가-힣]", text))


def _best_hook_sentence(window_segments: list[dict]) -> str:
    opening_segments = [segment for segment in window_segments if segment["start"] - window_segments[0]["start"] <= 6]
    candidate_texts = [segment["text"].strip() for segment in opening_segments if segment["text"].strip()]
    if not candidate_texts:
        candidate_texts = [segment["text"].strip() for segment in window_segments[:2] if segment["text"].strip()]
    ranked = sorted(candidate_texts, key=lambda item: ("?" in item or "!" in item, len(item)), reverse=True)
    hook = _normalize_text(ranked[0] if ranked else "")
    return hook[:110].rstrip() + "..." if len(hook) > 110 else hook


def _contains_any(text: str, terms: set[str]) -> bool:
    lowered = text.lower()
    return any(term in lowered for term in terms)


def _profile_title(profile: str, window_text: str, hook_text: str, keywords: list[str], proper_names: list[str]) -> str:
    lowered = window_text.lower()
    subject = proper_names[0] if proper_names else ""
    profile_copy = PROFILE_COPY[profile]
    if _contains_any(lowered, PROFILE_CLIMAX_TERMS[profile]):
        title = f"{subject}, {profile_copy['impact_title']}" if subject else profile_copy["impact_title"]
    elif _contains_any(lowered, PROFILE_ANALYSIS_TERMS[profile]):
        title = f"{subject} {profile_copy['analysis_title']}" if subject else profile_copy["analysis_title"]
    else:
        title = f"{subject}, {profile_copy['fallback_title']}" if subject else profile_copy["fallback_title"]

    for keyword in keywords:
        clean_keyword = re.sub(r"[^0-9A-Za-z가-힣]+", "", keyword)
        if clean_keyword and clean_keyword.lower() in PROFILE_SUFFIX_KEYWORDS.get(profile, set()):
            suffix = clean_keyword.capitalize() if not _contains_korean(clean_keyword) else clean_keyword
            title = f"{title} | {suffix}"
            break

    if len(title) <= 72:
        return title
    trimmed_hook = hook_text.strip(" .!?")
    return trimmed_hook[:69].rstrip() + "..."


def _profile_description(profile: str, window_segments: list[dict], hook_text: str, window_text: str) -> str:
    first_line = window_segments[0]["text"].strip() if window_segments else hook_text
    profile_copy = PROFILE_COPY[profile]
    if _contains_any(window_text.lower(), PROFILE_CLIMAX_TERMS[profile]):
        description = f"{first_line} {profile_copy['impact_desc']}"
    elif _contains_any(window_text.lower(), PROFILE_ANALYSIS_TERMS[profile]):
        description = f"{first_line} {profile_copy['analysis_desc']}"
    else:
        description = f"{first_line} {profile_copy['fallback_desc']}"
    return description[:220].rstrip()


def _profile_hashtags(profile: str, window_text: str, keywords: list[str]) -> str:
    tags = list(PROFILE_BASE_TAGS[profile])
    lowered = window_text.lower()

    extra_tags = {
        CONTENT_PROFILE_COMBAT_SPORTS: {
            "boxing": "#boxing",
            "복싱": "#복싱훈련",
            "ufc": "#ufc",
            "kickboxing": "#kickboxing",
            "knockout": "#knockout",
            "submission": "#submission",
        },
        CONTENT_PROFILE_SOCCER: {
            "goal": "#goal",
            "골": "#골모음",
            "freekick": "#freekick",
            "penalty": "#penalty",
            "stoppage": "#추가시간",
        },
        CONTENT_PROFILE_RACING: {
            "f1": "#f1",
            "overtake": "#overtake",
            "pit": "#pitstop",
            "pole": "#poleposition",
            "lap": "#lastlap",
        },
        CONTENT_PROFILE_FIGURE_SKATING: {
            "quad": "#quad",
            "axel": "#axel",
            "spin": "#spin",
            "program": "#program",
            "pcs": "#pcs",
        },
        CONTENT_PROFILE_BASEBALL: {
            "mlb": "#mlb",
            "home": "#homerun",
            "홈런": "#홈런",
            "walkoff": "#walkoff",
            "strikeout": "#strikeout",
        },
    }

    for trigger, tag in extra_tags.get(profile, {}).items():
        if trigger in lowered:
            tags.append(tag)

    for keyword in keywords[:4]:
        normalized = re.sub(r"[^0-9A-Za-z가-힣]+", "", keyword)
        lowered_keyword = normalized.lower()
        if normalized and len(normalized) >= 4 and lowered_keyword not in STOPWORDS and lowered_keyword not in GENERIC_KEYWORDS:
            tags.append(f"#{normalized}")

    unique_tags: list[str] = []
    for tag in tags:
        if tag not in unique_tags:
            unique_tags.append(tag)
    return " ".join(unique_tags[:8])


class HeuristicClipMetadataGenerator(ClipMetadataGenerator):
    def generate(self, window_segments: list[dict], window_text: str, *, content_profile: str | None = None) -> ClipMetadata:
        hook_text = _best_hook_sentence(window_segments) or "This is the key moment."
        keywords = _extract_keywords(window_text)
        proper_names = _extract_proper_names(window_text)
        resolved_profile = content_profile or detect_content_profile_from_text(window_text)

        if resolved_profile in PROFILE_COPY:
            title = _profile_title(resolved_profile, window_text, hook_text, keywords, proper_names)
            description = _profile_description(resolved_profile, window_segments, hook_text, window_text)
            hashtags_string = _profile_hashtags(resolved_profile, window_text, keywords)
            if len(hook_text) > 34:
                hook_text = PROFILE_COPY[resolved_profile]["short_hook"]
        else:
            title_seed = hook_text.strip(" .!?")
            if len(title_seed) > 62:
                title_seed = title_seed[:59].rstrip() + "..."
            if keywords:
                title = f"{title_seed} | {keywords[0].capitalize()}"
            else:
                title = title_seed or "Shortform Highlight"

            sentences = [part.strip() for part in re.split(r"(?<=[.!?])\s+|\n+", window_text) if part.strip()]
            description = " ".join(sentences[:2]) or hook_text
            if len(description) > 220:
                description = description[:217].rstrip() + "..."

            hashtags = ["#shorts", "#verticalvideo", "#clip"]
            for keyword in keywords[:5]:
                normalized = re.sub(r"[^0-9A-Za-z가-힣]+", "", keyword)
                if normalized:
                    hashtags.append(f"#{normalized}")
            unique_tags: list[str] = []
            for tag in hashtags:
                if tag not in unique_tags:
                    unique_tags.append(tag)
            hashtags_string = " ".join(unique_tags[:8])

        return ClipMetadata(
            hook_text=hook_text,
            suggested_title=title,
            suggested_description=description,
            suggested_hashtags=hashtags_string,
        )


DEFAULT_METADATA_GENERATOR = HeuristicClipMetadataGenerator()
