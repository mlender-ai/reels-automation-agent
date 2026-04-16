from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
AUTOMATION_OUTPUT_DIR = ROOT / "automation-output"
DEFAULT_GITHUB_MODELS_URL = "https://models.github.ai/inference/chat/completions"
DEFAULT_GITHUB_MODELS_MODEL = "openai/gpt-4.1"

IGNORED_PARTS = {
    ".git",
    ".venv",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    "__pycache__",
    "node_modules",
    "dist",
    "automation-output",
}

ALLOWED_AUTO_PR_PREFIXES = (
    "README.md",
    "docs/",
    "frontend/src/",
    "frontend/index.html",
    "frontend/package.json",
    "backend/app/api/",
    "backend/app/core/",
    "backend/app/schemas/",
    "backend/app/services/",
    "backend/app/utils/",
    ".github/prompts/",
    "prompts/",
    "scripts/",
)

FORBIDDEN_AUTO_PR_PREFIXES = (
    ".github/workflows/",
    "backend/app/db/",
    "backend/app/models/",
    "backend/data/",
    ".env",
    "backend/.env",
    "frontend/.env",
)

DEFAULT_LABEL_COLORS = {
    "ai-generated": "7f8cff",
    "needs-human-review": "fbca04",
    "qa": "d73a4a",
    "po": "1d76db",
    "pm": "0e8a16",
    "cto": "5319e7",
    "bug": "b60205",
    "enhancement": "a2eeef",
    "priority:high": "b60205",
    "priority:medium": "fbca04",
    "priority:low": "0e8a16",
}


class AutomationError(RuntimeError):
    pass


@dataclass
class DiffStats:
    changed_files: list[str]
    added_lines: int
    removed_lines: int

    @property
    def total_lines(self) -> int:
        return self.added_lines + self.removed_lines


def ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def utc_timestamp() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")


def read_text(path: Path, limit: int | None = None) -> str:
    if not path.exists():
        return f"(missing: {path.relative_to(ROOT)})"
    try:
        content = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        content = path.read_text(errors="ignore")
    return content if limit is None else content[:limit]


def write_text(path: Path, content: str) -> Path:
    ensure_dir(path.parent)
    path.write_text(content, encoding="utf-8")
    return path


def write_json(path: Path, payload: Any) -> Path:
    ensure_dir(path.parent)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def load_prompt(relative_path: str) -> str:
    return read_text(ROOT / relative_path)


def resolve_api_url(raw_url: str) -> str:
    url = raw_url.rstrip("/")
    if url.endswith("/chat/completions") or url.endswith("/v1/chat/completions"):
        return url
    if url.endswith("/v1"):
        return f"{url}/chat/completions"
    return f"{url}/v1/chat/completions"


def unwrap_content(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict):
                if "text" in item:
                    parts.append(str(item["text"]))
                else:
                    parts.append(json.dumps(item, ensure_ascii=False))
            else:
                parts.append(str(item))
        return "\n".join(parts)
    return str(content)


def call_chat_completion(
    *,
    system_prompt: str,
    user_prompt: str,
    temperature: float | None = None,
    max_tokens: int = 2200,
) -> str:
    api_url = os.environ.get("AI_API_URL", "").strip() or DEFAULT_GITHUB_MODELS_URL
    configured_api_key = os.environ.get("AI_API_KEY", "").strip()
    api_key = configured_api_key
    if not api_key or api_key.upper() == "USE_GITHUB_TOKEN":
        api_key = os.environ.get("GITHUB_TOKEN", "").strip()
    model = os.environ.get("AI_MODEL", "").strip() or DEFAULT_GITHUB_MODELS_MODEL
    if not api_key:
        raise AutomationError("AI_API_KEY was not set and GITHUB_TOKEN fallback was unavailable")

    if temperature is None:
        raw_temperature = os.environ.get("AI_TEMPERATURE", "0.2").strip() or "0.2"
        temperature = float(raw_temperature)

    payload = {
        "model": model,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }

    resolved_url = resolve_api_url(api_url)
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    if "models.github.ai" in resolved_url:
        headers["Accept"] = "application/vnd.github+json"
        headers["X-GitHub-Api-Version"] = "2022-11-28"

    request = urllib.request.Request(
        resolved_url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=300) as response:
            raw = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="ignore")
        raise AutomationError(f"AI request failed with HTTP {exc.code}: {details}") from exc
    except urllib.error.URLError as exc:
        raise AutomationError(f"AI request failed: {exc}") from exc

    parsed = json.loads(raw)
    try:
        content = unwrap_content(parsed["choices"][0]["message"]["content"]).strip()
    except (KeyError, IndexError) as exc:
        raise AutomationError(f"Unexpected AI response payload: {raw}") from exc
    if not content:
        raise AutomationError("AI response content was empty")
    return content


def extract_json_payload(raw_text: str) -> Any:
    text = raw_text.strip()
    candidates: list[str] = [text]

    fenced_matches = re.findall(r"```json\s*(.*?)```", text, re.DOTALL | re.IGNORECASE)
    candidates.extend(fenced_matches)

    first_object = text.find("{")
    last_object = text.rfind("}")
    if first_object != -1 and last_object != -1 and last_object > first_object:
        candidates.append(text[first_object : last_object + 1])

    first_array = text.find("[")
    last_array = text.rfind("]")
    if first_array != -1 and last_array != -1 and last_array > first_array:
        candidates.append(text[first_array : last_array + 1])

    for candidate in candidates:
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            continue
    raise AutomationError(f"Could not parse JSON from AI response:\n{text}")


def run_git(*args: str, check: bool = False) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    if check and result.returncode != 0:
        stderr = result.stderr.strip()
        stdout = result.stdout.strip()
        message = stderr or stdout or f"git {' '.join(args)} failed"
        raise AutomationError(message)
    return result


def git_output(*args: str) -> str:
    result = run_git(*args, check=False)
    output = (result.stdout or result.stderr).strip()
    return output or "(no output)"


def build_tree(max_depth: int = 4, max_entries: int = 500) -> str:
    lines: list[str] = []
    for path in sorted(ROOT.rglob("*")):
        rel = path.relative_to(ROOT)
        if any(part in IGNORED_PARTS for part in rel.parts):
            continue
        if len(rel.parts) > max_depth:
            continue
        indent = "  " * (len(rel.parts) - 1)
        suffix = "/" if path.is_dir() else ""
        lines.append(f"{indent}{path.name}{suffix}")
        if len(lines) >= max_entries:
            break
    return "\n".join(lines) or "(empty tree)"


def build_repo_context() -> str:
    return "\n\n".join(
        [
            "# Repository Snapshot",
            f"Repository: {os.environ.get('GITHUB_REPOSITORY', '(local)')}",
            f"SHA: {os.environ.get('GITHUB_SHA', '(unknown)')}",
            "## Recent Commits",
            git_output("log", "--oneline", "-5"),
            "## Git Status",
            git_output("status", "--short"),
            "## File Tree",
            build_tree(),
            "## Root README Excerpt",
            read_text(ROOT / "README.md", limit=8000),
            "## AI System README Excerpt",
            read_text(ROOT / "docs" / "ai-system" / "README.md", limit=6000),
        ]
    )


def summarize_markdown(markdown: str) -> str:
    for raw_line in markdown.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("#"):
            continue
        if line.startswith("- "):
            return line[2:].strip()
        return line
    return "(no summary)"


def write_step_summary(content: str) -> None:
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not summary_path:
        return
    with open(summary_path, "a", encoding="utf-8") as handle:
        handle.write(content)
        if not content.endswith("\n"):
            handle.write("\n")


def set_github_outputs(**values: str) -> None:
    output_path = os.environ.get("GITHUB_OUTPUT")
    if not output_path:
        return
    with open(output_path, "a", encoding="utf-8") as handle:
        for key, value in values.items():
            handle.write(f"{key}={value}\n")


def latest_subdir(path: Path) -> Path:
    if not path.exists():
        raise AutomationError(f"No output directory exists at {path}")
    directories = [item for item in path.iterdir() if item.is_dir()]
    if not directories:
        raise AutomationError(f"No run directories found under {path}")
    return sorted(directories)[-1]


def list_repo_files() -> list[str]:
    files: list[str] = []
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(ROOT)
        if any(part in IGNORED_PARTS for part in rel.parts):
            continue
        files.append(rel.as_posix())
    return files


def extract_paths_mentioned(text: str, repo_files: list[str], max_matches: int = 5) -> list[str]:
    matches: list[str] = []
    for repo_file in repo_files:
        if repo_file in text:
            matches.append(repo_file)
        if len(matches) >= max_matches:
            break
    return matches


def slugify(value: str, max_length: int = 48) -> str:
    lowered = value.lower().strip()
    lowered = re.sub(r"[^a-z0-9]+", "-", lowered)
    lowered = re.sub(r"-{2,}", "-", lowered).strip("-")
    return lowered[:max_length] or "update"


def is_true(value: str | None) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


def allowed_auto_pr_path(path: str) -> bool:
    if path in FORBIDDEN_AUTO_PR_PREFIXES:
        return False
    if any(path.startswith(prefix) for prefix in FORBIDDEN_AUTO_PR_PREFIXES):
        return False
    return path == "README.md" or any(path.startswith(prefix) for prefix in ALLOWED_AUTO_PR_PREFIXES)


def parse_unified_diff_stats(patch_text: str) -> DiffStats:
    changed_files: list[str] = []
    added_lines = 0
    removed_lines = 0

    for line in patch_text.splitlines():
        if line.startswith("diff --git "):
            parts = line.split()
            if len(parts) >= 4:
                path = parts[3]
                if path.startswith("b/"):
                    changed_files.append(path[2:])
                else:
                    changed_files.append(path)
            continue
        if line.startswith("+++ ") or line.startswith("--- "):
            continue
        if line.startswith("@@"):
            continue
        if line.startswith("+"):
            added_lines += 1
        elif line.startswith("-"):
            removed_lines += 1

    unique_files = list(dict.fromkeys(changed_files))
    return DiffStats(changed_files=unique_files, added_lines=added_lines, removed_lines=removed_lines)


def contains_forbidden_patch_terms(patch_text: str) -> bool:
    forbidden_terms = [
        "DROP TABLE",
        "rm -rf",
        "DELETE FROM",
        "GITHUB_TOKEN",
        "AI_API_KEY",
        "AUTO_PR_ENABLED",
        "AUTO_ISSUE_ENABLED",
    ]
    upper_text = patch_text.upper()
    return any(term.upper() in upper_text for term in forbidden_terms)


def load_json(path: Path) -> Any:
    return json.loads(read_text(path))


def github_api_request(
    *,
    method: str,
    path: str,
    payload: dict[str, Any] | None = None,
    token: str | None = None,
) -> Any:
    token = token or os.environ.get("GITHUB_TOKEN", "").strip()
    repository = os.environ.get("GITHUB_REPOSITORY", "").strip()
    if not token or not repository:
        raise AutomationError("GITHUB_TOKEN and GITHUB_REPOSITORY are required for GitHub API operations")

    url = f"https://api.github.com{path}"
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(
        url,
        data=data,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "reels-automation-agent",
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            raw = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="ignore")
        raise AutomationError(f"GitHub API {method} {path} failed with HTTP {exc.code}: {details}") from exc
    return json.loads(raw) if raw else {}


def ensure_github_label(name: str) -> None:
    repository = os.environ.get("GITHUB_REPOSITORY", "").strip()
    token = os.environ.get("GITHUB_TOKEN", "").strip()
    if not repository or not token:
        return

    owner, repo = repository.split("/", 1)
    color = DEFAULT_LABEL_COLORS.get(name, "bfd4f2")
    payload = {"name": name, "color": color}
    request = urllib.request.Request(
        f"https://api.github.com/repos/{owner}/{repo}/labels",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "reels-automation-agent",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=120):
            return
    except urllib.error.HTTPError as exc:
        if exc.code == 422:
            return
        details = exc.read().decode("utf-8", errors="ignore")
        raise AutomationError(f"Failed to ensure label {name}: {details}") from exc


def ensure_github_labels(labels: list[str]) -> None:
    for label in labels:
        ensure_github_label(label)


def fail(message: str, exit_code: int = 1) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(exit_code)
