from __future__ import annotations

import argparse
from pathlib import Path

from automation_common import (
    AUTOMATION_OUTPUT_DIR,
    ROOT,
    build_repo_context,
    call_chat_completion,
    ensure_dir,
    load_prompt,
    set_github_outputs,
    summarize_markdown,
    utc_timestamp,
    write_json,
    write_step_summary,
    write_text,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the QA -> PO -> PM -> CTO AI loop.")
    parser.add_argument(
        "--output-root",
        default=str(AUTOMATION_OUTPUT_DIR / "agent-runs"),
        help="Directory that stores timestamped agent run outputs.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output_root = Path(args.output_root)
    timestamp = utc_timestamp()
    output_dir = ensure_dir(output_root / timestamp)

    stages = ["qa", "po", "pm", "cto"]
    repo_context = build_repo_context()
    stage_outputs: dict[str, str] = {}
    stage_summaries: dict[str, str] = {}

    for stage in stages:
        prompt_text = load_prompt(f".github/prompts/{stage}.md")
        prior_blocks = []
        for previous_stage, content in stage_outputs.items():
            prior_blocks.append(f"## {previous_stage.upper()} Output\n\n{content}")

        user_prompt = "\n\n".join(
            [
                prompt_text,
                repo_context,
                "# Prior Stage Outputs",
                "\n\n".join(prior_blocks) if prior_blocks else "(none yet)",
            ]
        )
        result = call_chat_completion(
            system_prompt=(
                f"You are the {stage.upper()} role in the reels-automation-agent operating loop. "
                "Produce a concise, evidence-based markdown report that follows the requested output shape."
            ),
            user_prompt=user_prompt,
            max_tokens=2200,
        )
        stage_outputs[stage] = result.strip()
        stage_summaries[stage] = summarize_markdown(result)
        write_text(output_dir / f"{stage}.md", stage_outputs[stage] + "\n")

    manifest = {
        "timestamp_utc": timestamp,
        "repository": ROOT.name,
        "stages": {
            stage: {
                "file": f"{stage}.md",
                "summary": stage_summaries[stage],
            }
            for stage in stages
        },
    }
    write_json(output_dir / "manifest.json", manifest)

    index_lines = [
        "# Agent Loop Run",
        "",
        f"- Timestamp (UTC): {timestamp}",
        f"- Repository: {ROOT.name}",
        "",
        "## Stage Summaries",
    ]
    for stage in stages:
        index_lines.append(f"- `{stage}`: {stage_summaries[stage]}")
    write_text(output_dir / "README.md", "\n".join(index_lines) + "\n")

    write_step_summary(
        "\n".join(
            [
                "## Agent Loop",
                f"- Output: `automation-output/agent-runs/{timestamp}`",
                *[f"- `{stage}`: {stage_summaries[stage]}" for stage in stages],
                "",
            ]
        )
    )
    set_github_outputs(output_dir=str(output_dir.relative_to(ROOT)), artifact_name=f"agent-loop-{timestamp}")
    print(output_dir)


if __name__ == "__main__":
    main()
