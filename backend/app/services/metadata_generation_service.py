import re
from abc import ABC, abstractmethod
from collections import Counter
from dataclasses import dataclass


STOPWORDS = {
    "the",
    "and",
    "that",
    "this",
    "with",
    "from",
    "your",
    "have",
    "what",
    "when",
    "then",
    "into",
    "about",
    "really",
    "there",
    "because",
    "영상",
    "이거",
    "그거",
    "이제",
    "정말",
    "그리고",
    "하지만",
    "그러면",
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


class HeuristicClipMetadataGenerator(ClipMetadataGenerator):
    def generate(self, window_segments: list[dict], window_text: str) -> ClipMetadata:
        hook_text = _best_hook_sentence(window_segments) or "This is the key moment."
        keywords = _extract_keywords(window_text)
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

        return ClipMetadata(
            hook_text=hook_text,
            suggested_title=title,
            suggested_description=description,
            suggested_hashtags=" ".join(unique_tags[:8]),
        )


DEFAULT_METADATA_GENERATOR = HeuristicClipMetadataGenerator()
