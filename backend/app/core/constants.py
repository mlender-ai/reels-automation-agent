from enum import Enum


class ProjectStatus(str, Enum):
    draft = "draft"
    uploaded = "uploaded"
    transcribed = "transcribed"
    clips_generated = "clips_generated"
    ready_for_review = "ready_for_review"
    exported = "exported"
    failed = "failed"


class ClipStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    exported = "exported"


class ExportStatus(str, Enum):
    processing = "processing"
    completed = "completed"
    failed = "failed"


class PublishStatus(str, Enum):
    not_connected = "not_connected"
    ready = "ready"
    queued = "queued"
    failed = "failed"
    posted = "posted"


class WorkflowJobType(str, Enum):
    transcribe = "transcribe"
    generate_clips = "generate_clips"
    export = "export"
    publish = "publish"


class WorkflowJobStatus(str, Enum):
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"


class SubtitlePreset(str, Enum):
    clean = "clean"
    bold = "bold"
    creator = "creator"


HOOK_KEYWORDS = {
    "en": [
        "secret",
        "why",
        "how",
        "best",
        "mistake",
        "truth",
        "surprising",
        "shocking",
        "core",
        "key",
        "critical",
        "important",
        "first",
        "three",
        "top",
    ],
    "ko": [
        "핵심",
        "결정적",
        "놀라운",
        "진짜",
        "비밀",
        "실수",
        "중요",
        "이 장면",
        "결론",
        "먼저",
        "세 가지",
        "1위",
        "방법",
    ],
}


EMOTION_KEYWORDS = {
    "en": ["amazing", "insane", "crazy", "love", "hate", "worst", "best", "wow", "unbelievable"],
    "ko": ["대박", "미쳤", "충격", "진짜", "최고", "최악", "와", "엄청", "놀랍"],
}


COMPARISON_KEYWORDS = {
    "en": ["better", "worse", "versus", "vs", "compare", "difference", "instead", "before", "after"],
    "ko": ["비교", "차이", "대신", "전", "후", "낫", "별로", "더 좋", "반대로"],
}


FILLER_PREFIXES = {
    "en": ["so", "and", "well", "okay", "like"],
    "ko": ["그러니까", "약간", "어쨌든", "근데", "그리고"],
}


SUBTITLE_STYLE_MAP = {
    SubtitlePreset.clean.value: "FontSize=20,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H96000000,BorderStyle=1,Outline=3,Shadow=0,Alignment=2,MarginV=118",
    SubtitlePreset.bold.value: "FontSize=22,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&HAA000000,BorderStyle=1,Outline=4,Shadow=0,Alignment=2,MarginV=122",
    SubtitlePreset.creator.value: "FontSize=21,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&HAA000000,BackColour=&H5A000000,BorderStyle=3,Outline=1,Shadow=0,Alignment=2,MarginV=136",
}
