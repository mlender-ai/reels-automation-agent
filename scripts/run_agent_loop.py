from __future__ import annotations

import argparse
from pathlib import Path

from automation_common import (
    REPORTS_DIR,
    ROOT,
    build_repo_context,
    ensure_dir,
    fail,
    load_prompt,
    set_github_outputs,
    summarize_markdown,
    utc_timestamp,
    write_json,
    write_step_summary,
    write_text,
)
from common_llm import LLMError, call_chat_completion


STAGES = ["qa", "po", "pm", "cto"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the QA -> PO -> PM -> CTO AI loop.")
    parser.add_argument(
        "--output-root",
        default=str(REPORTS_DIR),
        help="Directory that stores role reports and run manifests.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output_root = Path(args.output_root)
    timestamp = utc_timestamp()
    run_dir = ensure_dir(output_root / "agent-runs" / timestamp)
    repo_context = build_repo_context()
    stage_outputs: dict[str, str] = {}
    stage_summaries: dict[str, str] = {}
    report_paths: dict[str, str] = {}

    try:
        for stage in STAGES:
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
            ).strip()

            stage_outputs[stage] = result
            stage_summaries[stage] = summarize_markdown(result)

            role_path = write_text(output_root / stage / f"{timestamp}.md", result + "\n")
            run_stage_path = write_text(run_dir / f"{stage}.md", result + "\n")
            report_paths[stage] = str(role_path.relative_to(ROOT))
            if run_stage_path.relative_to(ROOT).as_posix() == report_paths[stage]:
                report_paths[stage] = str(run_stage_path.relative_to(ROOT))
    except (LLMError, RuntimeError, ValueError) as exc:
        fail(f"agent loop failed: {exc}", exit_code=1)

    manifest = {
        "timestamp_utc": timestamp,
        "repository": ROOT.name,
        "reports": report_paths,
        "run_directory": str(run_dir.relative_to(ROOT)),
        "stages": {stage: {"summary": stage_summaries[stage]} for stage in STAGES},
    }
    manifest_path = write_json(output_root / "agent-runs" / f"{timestamp}.json", manifest)

    index_lines = [
        "# Agent Loop Run",
        "",
        f"- Timestamp (UTC): {timestamp}",
        f"- Repository: {ROOT.name}",
        f"- Run Directory: `{run_dir.relative_to(ROOT)}`",
        "",
        "## Stage Summaries",
    ]
    for stage in STAGES:
        index_lines.append(f"- `{stage}`: {stage_summaries[stage]}")
    write_text(run_dir / "README.md", "\n".join(index_lines) + "\n")

    write_step_summary(
        "\n".join(
            [
                "## Agent Loop",
                f"- Reports root: `{output_root.relative_to(ROOT)}`",
                f"- Timestamp: `{timestamp}`",
                *[f"- `{stage}`: {stage_summaries[stage]}" for stage in STAGES],
                "",
            ]
        )
    )
    set_github_outputs(
        output_dir=str(output_root.relative_to(ROOT)),
        agent_run=str(run_dir.relative_to(ROOT)),
        manifest_path=str(manifest_path.relative_to(ROOT)),
        timestamp=timestamp,
        artifact_name=f"agent-reports-{timestamp}",
    )
    print(run_dir)


if __name__ == "__main__":
    main()
