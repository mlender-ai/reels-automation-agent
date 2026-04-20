import re
from abc import ABC, abstractmethod
from collections import Counter
from dataclasses import dataclass

from app.services.content_profile_service import (
    COMBAT_SPORTS_ANALYSIS_TERMS,
    COMBAT_SPORTS_FINISH_TERMS,
    CONTENT_PROFILE_COMBAT_SPORTS,
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
}

GENERIC_KEYWORDS = {
    "fight",
    "fighter",
    "fighters",
    "moment",
    "sequence",
    "video",
    "short",
    "clip",
}

COMBAT_SPORTS_SUFFIX_KEYWORDS = {
    "knockout",
    "counter",
    "referee",
    "corner",
    "jab",
    "feint",
    "angle",
    "takedown",
    "submission",
    "champion",
    "round",
    "pressure",
    "distance",
    "timing",
    "setup",
    "fence",
    "bodyshot",
    "headkick",
}


@dataclass
class ClipMetadata:
    hook_text: str
    suggested_title: str
    suggested_description: str
    suggested_hashtags: str


class ClipMetadataGenerator(ABC):
    @abstractmethod
    def generate(self, window_segments: list[dict], window_text: str) -> ClipMetadata:
        raise NotImplementedError


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _extract_keywords(text: str, limit: int = 5) -> list[str]:
    tokens = re.findall(r"[0-9A-Za-z가-힣]{2,}", text.lower())
    counter = Counter(token for token in tokens if token not in STOPWORDS and not token.isdigit())
    return [token for token, _ in counter.most_common(limit)]


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


def _combat_sports_title(window_text: str, hook_text: str, keywords: list[str]) -> str:
    lowered = window_text.lower()
    if _contains_any(lowered, COMBAT_SPORTS_FINISH_TERMS):
        title = "The exact moment the fight flipped"
    elif _contains_any(lowered, COMBAT_SPORTS_ANALYSIS_TERMS):
        title = "Why this exchange changed the fight"
    elif any(keyword in lowered for keyword in ["round", "라운드", "final", "마지막"]):
        title = "One exchange changed the whole round"
    else:
        title = "Fight IQ on full display here"

    for keyword in keywords:
        clean_keyword = re.sub(r"[^0-9A-Za-z가-힣]+", "", keyword)
        if clean_keyword and clean_keyword.lower() in COMBAT_SPORTS_SUFFIX_KEYWORDS:
            title = f"{title} | {clean_keyword.capitalize()}"
            break
    if len(title) <= 70:
        return title
    trimmed_hook = hook_text.strip(" .!?")
    return trimmed_hook[:67].rstrip() + "..."


def _combat_sports_description(window_segments: list[dict], hook_text: str, window_text: str) -> str:
    first_line = window_segments[0]["text"].strip() if window_segments else hook_text
    if _contains_any(window_text, COMBAT_SPORTS_FINISH_TERMS):
        description = f"{first_line} This cut isolates the decisive exchange and the finish that made the moment explode."
    elif _contains_any(window_text, COMBAT_SPORTS_ANALYSIS_TERMS):
        description = f"{first_line} This short works as a fast fight breakdown, with one setup, one punishment, and a clean payoff."
    else:
        description = f"{first_line} The clip stays focused on one swing moment so it feels immediate, readable, and replayable."
    return description[:220].rstrip()


def _combat_sports_hashtags(window_text: str, keywords: list[str]) -> str:
    tags = ["#shorts", "#mma", "#combatSports", "#fightBreakdown"]
    lowered = window_text.lower()
    if "boxing" in lowered or "복싱" in lowered:
        tags.append("#boxing")
    if "muay" in lowered or "무에타이" in lowered:
        tags.append("#muaythai")
    if "ufc" in lowered:
        tags.append("#ufc")
    if "kickboxing" in lowered or "킥복싱" in lowered:
        tags.append("#kickboxing")
    if any(term in lowered for term in ["knockout", "ko", "다운", "실신"]):
        tags.append("#knockout")
    if any(term in lowered for term in ["submission", "초크", "암바", "tap", "tapped"]):
        tags.append("#submission")
    for keyword in keywords[:4]:
        normalized = re.sub(r"[^0-9A-Za-z가-힣]+", "", keyword)
        lowered = normalized.lower()
        if normalized and len(normalized) >= 4 and lowered not in STOPWORDS and lowered not in GENERIC_KEYWORDS:
            tags.append(f"#{normalized}")

    unique_tags: list[str] = []
    for tag in tags:
        if tag not in unique_tags:
            unique_tags.append(tag)
    return " ".join(unique_tags[:8])


class HeuristicClipMetadataGenerator(ClipMetadataGenerator):
    def generate(self, window_segments: list[dict], window_text: str) -> ClipMetadata:
        hook_text = _best_hook_sentence(window_segments) or "This is the key moment."
        keywords = _extract_keywords(window_text)
        content_profile = detect_content_profile_from_text(window_text)

        if content_profile == CONTENT_PROFILE_COMBAT_SPORTS:
            title = _combat_sports_title(window_text, hook_text, keywords)
            description = _combat_sports_description(window_segments, hook_text, window_text)
            hashtags_string = _combat_sports_hashtags(window_text, keywords)
        else:
            title_seed = hook_text.strip(" .!?")
            if len(title_seed) > 62:
                title_seed = title_seed[:59].rstrip() + "..."
            if keywords:
                title = f"{title_seed} | {keywords[0].capitalize()}"
            else:
                title = title_seed or "Shortform Highlight"

            sentences = [part.strip() for part in re.split(r"(?<=[.!?])\s+|\n+", window_text) if part.strip()]
            description = " ".join(sentences[:2])
            if not description:
                description = hook_text
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
