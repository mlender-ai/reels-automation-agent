from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any

from automation_common import (
    REPORTS_DIR,
    ROOT,
    allowed_auto_pr_path,
    build_tree,
    contains_forbidden_patch_terms,
    ensure_dir,
    extract_json_payload,
    extract_paths_mentioned,
    latest_subdir,
    list_repo_files,
    load_prompt,
    parse_unified_diff_stats,
    read_text,
    set_github_outputs,
    slugify,
    utc_timestamp,
    write_json,
    write_step_summary,
    write_text,
)
from common_llm import call_chat_completion


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate a safe patch bundle from QA and CTO reports.")
    parser.add_argument(
        "--agent-run",
        default="",
        help="Optional explicit path to an agent run directory. Defaults to the latest run under reports/agent-runs.",
    )
    parser.add_argument(
        "--output-root",
        default=str(REPORTS_DIR / "patches"),
        help="Directory that stores timestamped patch bundle outputs.",
    )
    parser.add_argument("--max-files", type=int, default=5)
    parser.add_argument("--max-diff-lines", type=int, default=220)
    return parser.parse_args()


def normalize_bundle(payload: Any, timestamp: str) -> dict[str, Any]:
    bundle = payload if isinstance(payload, dict) else {}
    changed_files = bundle.get("changed_files") or []
    if not isinstance(changed_files, list):
        changed_files = [str(changed_files)]
    validation_steps = bundle.get("validation_steps") or []
    if not isinstance(validation_steps, list):
        validation_steps = [str(validation_steps)]
    return {
        "safe_to_apply": bool(bundle.get("safe_to_apply", False)),
        "title": str(bundle.get("title", "")).strip(),
        "rationale": str(bundle.get("rationale", "")).strip(),
        "changed_files": [str(path).strip() for path in changed_files if str(path).strip()],
        "patch": str(bundle.get("patch", "")).strip(),
        "risk": str(bundle.get("risk", "medium")).strip().lower() or "medium",
        "validation_steps": [str(step).strip() for step in validation_steps if str(step).strip()],
        "branch_name": str(bundle.get("branch_name", "")).strip(),
        "commit_message": str(bundle.get("commit_message", "")).strip(),
        "validation_errors": [],
        "timestamp_utc": timestamp,
    }


def latest_agent_run(agent_run_arg: str) -> Path:
    if agent_run_arg:
        path = Path(agent_run_arg)
        return path if path.is_absolute() else (ROOT / path).resolve()
    return latest_subdir(REPORTS_DIR / "agent-runs")


def build_candidate_file_context(report_text: str, max_files: int) -> list[dict[str, str]]:
    repo_files = list_repo_files()
    mentioned = extract_paths_mentioned(report_text, repo_files, max_matches=max_files * 2)
    selected = [path for path in mentioned if allowed_auto_pr_path(path)][:max_files]
    context: list[dict[str, str]] = []
    for relative_path in selected:
        context.append(
            {
                "path": relative_path,
                "content": read_text(ROOT / relative_path, limit=12000),
            }
        )
    return context


def validate_bundle(bundle: dict[str, Any], candidate_paths: list[str], max_files: int, max_diff_lines: int) -> None:
    patch = bundle["patch"]
    errors: list[str] = []
    diff_stats = parse_unified_diff_stats(patch) if patch else None

    if bundle["safe_to_apply"] and not patch:
        errors.append("safe_to_apply was true but patch was empty")

    if diff_stats and diff_stats.changed_files and not bundle["changed_files"]:
        bundle["changed_files"] = diff_stats.changed_files

    if len(bundle["changed_files"]) > max_files:
        errors.append(f"bundle touches {len(bundle['changed_files'])} files which exceeds the limit of {max_files}")

    for path in bundle["changed_files"]:
        if not allowed_auto_pr_path(path):
            errors.append(f"file is outside the auto-PR allowlist: {path}")
        if candidate_paths and path not in candidate_paths:
            errors.append(f"file was not part of the candidate context: {path}")

    if diff_stats:
        if diff_stats.total_lines > max_diff_lines:
            errors.append(f"diff size {diff_stats.total_lines} exceeds the limit of {max_diff_lines}")
        unexpected = [path for path in diff_stats.changed_files if path not in bundle["changed_files"]]
        if unexpected:
            errors.append(f"patch changes files not declared in changed_files: {', '.join(unexpected)}")

    if contains_forbidden_patch_terms(patch):
        errors.append("patch contains forbidden destructive or secret-related terms")

    if not bundle["branch_name"]:
        seed = bundle["title"] or bundle["rationale"] or "auto-fix"
        bundle["branch_name"] = f"codex/ai-auto-{timestamp_seed(bundle['timestamp_utc'])}-{slugify(seed)}"

    if not bundle["commit_message"]:
        commit_seed = bundle["title"] or "apply safe ai follow-up"
        bundle["commit_message"] = f"chore: {commit_seed[:58]}"

    bundle["validation_errors"] = errors
    if errors:
        bundle["safe_to_apply"] = False


def timestamp_seed(timestamp: str) -> str:
    return timestamp.replace("-", "").lower()[:12]


def main() -> None:
    args = parse_args()
    agent_run = latest_agent_run(args.agent_run)
    qa_report = read_text(agent_run / "qa.md")
    cto_report = read_text(agent_run / "cto.md")
    report_text = "\n\n".join([qa_report, cto_report])
    candidate_files = build_candidate_file_context(report_text, args.max_files)
    candidate_paths = [item["path"] for item in candidate_files]

    timestamp = utc_timestamp()
    output_dir = ensure_dir(Path(args.output_root) / timestamp)

    if not candidate_files:
        bundle = {
            "safe_to_apply": False,
            "title": "No safe auto-fix candidate found",
            "rationale": "QA/CTO reports did not reference allowed files clearly enough for a safe automated patch.",
            "changed_files": [],
            "patch": "",
            "risk": "low",
            "validation_steps": [],
            "branch_name": "",
            "commit_message": "",
            "validation_errors": ["No allowed file paths were referenced by QA or CTO reports."],
            "timestamp_utc": timestamp,
        }
    else:
        prompt_text = load_prompt(".github/prompts/patch-writer.md")
        pr_policy = read_text(ROOT / "docs" / "ai-system" / "PR_POLICY.md", limit=6000)
        user_prompt = "\n\n".join(
            [
                prompt_text,
                "# PR Policy",
                pr_policy,
                "# QA Report",
                qa_report,
                "# CTO Report",
                cto_report,
                "# Candidate File Contents",
                "\n\n".join(
                    [
                        f"## {item['path']}\n```text\n{item['content']}\n```"
                        for item in candidate_files
                    ]
                ),
                "# Compact File Tree",
                build_tree(max_depth=3, max_entries=220),
            ]
        )
        raw_response = call_chat_completion(
            system_prompt=(
                "You write safe patch bundles for reels-automation-agent. "
                "Return JSON only. Prefer no patch over a risky patch."
            ),
            user_prompt=user_prompt,
            max_tokens=2600,
        )
        bundle = normalize_bundle(extract_json_payload(raw_response), timestamp)
        validate_bundle(bundle, candidate_paths, args.max_files, args.max_diff_lines)

    write_json(
        output_dir / "bundle.json",
        {
            "agent_run": str(agent_run.relative_to(ROOT)),
            "candidate_files": candidate_paths,
            "bundle": bundle,
        },
    )

    lines = [
        "# Patch Bundle",
        "",
        f"- Source agent run: `{agent_run.relative_to(ROOT)}`",
        f"- Candidate files: {', '.join(candidate_paths) if candidate_paths else '(none)'}",
        f"- Safe to apply: `{bundle['safe_to_apply']}`",
        f"- Risk: `{bundle['risk']}`",
        "",
        "## Rationale",
        bundle["rationale"] or "(none)",
        "",
    ]
    if bundle["validation_errors"]:
        lines.extend(["## Validation Errors", *[f"- {error}" for error in bundle["validation_errors"]], ""])
    if bundle["changed_files"]:
        lines.extend(["## Changed Files", *[f"- `{path}`" for path in bundle["changed_files"]], ""])
    if bundle["validation_steps"]:
        lines.extend(["## Validation Steps", *[f"- {step}" for step in bundle["validation_steps"]], ""])
    if bundle["patch"]:
        lines.extend(["## Patch", "```diff", bundle["patch"], "```", ""])
    write_text(output_dir / "bundle.md", "\n".join(lines).strip() + "\n")

    write_step_summary(
        "\n".join(
            [
                "## Auto-PR Candidate",
                f"- Output: `{output_dir.relative_to(ROOT)}`",
                f"- Safe to apply: `{bundle['safe_to_apply']}`",
                f"- Candidate files: {', '.join(candidate_paths) if candidate_paths else '(none)'}",
                "",
            ]
        )
    )
    set_github_outputs(
        output_dir=str(output_dir.relative_to(ROOT)),
        bundle_path=str((output_dir / "bundle.json").relative_to(ROOT)),
        artifact_name=f"patch-bundle-{timestamp}",
    )
    print(output_dir)


if __name__ == "__main__":
    main()
