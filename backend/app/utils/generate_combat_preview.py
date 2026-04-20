# ruff: noqa: E402

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]
ROOT_DIR = BACKEND_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.append(str(BACKEND_DIR))

from app.services.clip_scoring_service import generate_ranked_candidate_windows


def build_preview_markdown(source_path: Path, title: str = "Combat Sports Preview") -> str:
    payload = json.loads(source_path.read_text(encoding="utf-8"))
    windows = generate_ranked_candidate_windows(payload.get("segments", []), content_profile="combat_sports")

    lines = [f"# {title}", "", f"Source: `{source_path.name}`", ""]
    lines.append("This preview was generated locally with the current heuristic clip scorer and combat-sports metadata templates.")
    lines.append("")
    for index, window in enumerate(windows, start=1):
        lines.extend(
            [
                f"## Candidate {index}",
                f"- Start: {window.start_time:.1f}s",
                f"- End: {window.end_time:.1f}s",
                f"- Duration: {window.duration:.1f}s",
                f"- Score: {window.score:.1f}",
                f"- Hook: {window.hook_text}",
                f"- Title: {window.suggested_title}",
                f"- Description: {window.suggested_description}",
                f"- Hashtags: {window.suggested_hashtags}",
                "",
            ]
        )
    return "\n".join(lines).rstrip() + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a markdown preview of combat-sports clip candidates.")
    parser.add_argument(
        "--input",
        type=Path,
        default=BACKEND_DIR / "data" / "seed" / "combat_sports_demo_transcript.json",
        help="Transcript JSON input path",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT_DIR / "docs" / "combat-sports-preview.md",
        help="Markdown output path",
    )
    args = parser.parse_args()

    markdown = build_preview_markdown(args.input)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(markdown, encoding="utf-8")
    print(f"Wrote preview to {args.output}")


if __name__ == "__main__":
    main()
