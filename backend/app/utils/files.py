import re
from pathlib import Path


def safe_filename(filename: str) -> str:
    filename = filename.strip().replace("\x00", "")
    stem = Path(filename).stem or "upload"
    suffix = Path(filename).suffix.lower()
    normalized = re.sub(r"[^a-zA-Z0-9._-]+", "-", stem).strip("-").lower()
    return f"{normalized or 'upload'}{suffix}"


def slugify_text(value: str, max_length: int = 64) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9가-힣]+", "-", value.strip().lower()).strip("-")
    if not normalized:
        return "asset"
    return normalized[:max_length].strip("-") or "asset"


def ensure_parent(path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    return path
