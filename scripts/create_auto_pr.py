from __future__ import annotations

import argparse
import os
import subprocess
from pathlib import Path
from typing import Any

from automation_common import (
    AUTOMATION_OUTPUT_DIR,
    ROOT,
    AutomationError,
    call_chat_completion,
    ensure_dir,
    ensure_github_labels,
    extract_json_payload,
    github_api_request,
    is_true,
    latest_subdir,
    load_json,
    load_prompt,
    parse_unified_diff_stats,
    run_git,
    set_github_outputs,
    slugify,
    utc_timestamp,
    write_json,
    write_step_summary,
    write_text,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Apply a safe patch bundle and open a draft pull request.")
    parser.add_argument(
        "--bundle",
        default="",
        help="Optional explicit path to a bundle.json file. Defaults to the latest bundle under automation-output/patch-bundles.",
    )
    parser.add_argument(
        "--output-root",
        default=str(AUTOMATION_OUTPUT_DIR / "pr-reports"),
        help="Directory that stores timestamped PR reports.",
    )
    return parser.parse_args()


def latest_bundle(bundle_arg: str) -> Path:
    if bundle_arg:
        path = Path(bundle_arg)
        return path if path.is_absolute() else (ROOT / path).resolve()
    latest_dir = latest_subdir(AUTOMATION_OUTPUT_DIR / "patch-bundles")
    return latest_dir / "bundle.json"


def generate_pr_metadata(bundle: dict[str, Any]) -> dict[str, Any]:
    prompt_text = load_prompt(".github/prompts/pr-writer.md")
    fallback = {
        "pr_title": bundle["title"] or "AI follow-up patch",
        "pr_body": "\n".join(
            [
                "## Summary",
                bundle["rationale"] or "Applies a small AI-generated follow-up patch.",
                "",
                "## Risk",
                bundle["risk"],
            ]
        ),
        "checklist": bundle.get("validation_steps", []),
        "risks": [bundle.get("risk", "medium")],
    }
    try:
        raw_response = call_chat_completion(
            system_prompt="You write pull request metadata for reels-automation-agent. Return JSON only.",
            user_prompt="\n\n".join(
                [
                    prompt_text,
                    "# Patch Bundle",
                    str(bundle),
                ]
            ),
            max_tokens=1800,
        )
        payload = extract_json_payload(raw_response)
        if isinstance(payload, dict):
            return {
                "pr_title": str(payload.get("pr_title", fallback["pr_title"])).strip() or fallback["pr_title"],
                "pr_body": str(payload.get("pr_body", fallback["pr_body"])).strip() or fallback["pr_body"],
                "checklist": payload.get("checklist") if isinstance(payload.get("checklist"), list) else fallback["checklist"],
                "risks": payload.get("risks") if isinstance(payload.get("risks"), list) else fallback["risks"],
            }
    except AutomationError:
        return fallback
    return fallback


def clean_worktree() -> bool:
    status = run_git("status", "--porcelain", check=False)
    return not status.stdout.strip()


def configure_git_identity() -> None:
    run_git("config", "user.name", "reels-automation-agent[bot]", check=True)
    run_git("config", "user.email", "reels-automation-agent[bot]@users.noreply.github.com", check=True)


def apply_patch(branch_name: str, patch_text: str, changed_files: list[str], report_dir: Path) -> dict[str, Any]:
    patch_path = write_text(report_dir / "patch.diff", patch_text + "\n")
    check_result = subprocess.run(
        ["git", "apply", "--check", str(patch_path)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    if check_result.returncode != 0:
        return {"status": "skipped", "reason": check_result.stderr.strip() or "git apply --check failed"}

    run_git("switch", "-c", branch_name, check=True)
    apply_result = subprocess.run(
        ["git", "apply", str(patch_path)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    if apply_result.returncode != 0:
        return {"status": "skipped", "reason": apply_result.stderr.strip() or "git apply failed"}

    if changed_files:
        run_git("add", "--", *changed_files, check=True)
    else:
        run_git("add", "-A", check=True)

    staged = run_git("diff", "--cached", "--name-only", check=False).stdout.strip()
    if not staged:
        return {"status": "skipped", "reason": "patch applied but did not stage any changes"}
    return {"status": "applied", "staged_files": staged.splitlines()}


def create_pull_request(branch_name: str, title: str, body: str, base_branch: str) -> dict[str, Any]:
    repository = os.environ["GITHUB_REPOSITORY"]
    payload = {
        "title": title,
        "head": branch_name,
        "base": base_branch,
        "body": body,
        "draft": True,
    }
    return github_api_request(method="POST", path=f"/repos/{repository}/pulls", payload=payload)


def label_pull_request(pr_number: int, labels: list[str]) -> None:
    repository = os.environ["GITHUB_REPOSITORY"]
    ensure_github_labels(labels)
    github_api_request(
        method="POST",
        path=f"/repos/{repository}/issues/{pr_number}/labels",
        payload={"labels": labels},
    )


def main() -> None:
    args = parse_args()
    bundle_path = latest_bundle(args.bundle)
    payload = load_json(bundle_path)
    bundle = payload.get("bundle", {})
    timestamp = utc_timestamp()
    output_dir = ensure_dir(Path(args.output_root) / timestamp)

    pr_metadata = generate_pr_metadata(bundle) if bundle else {
        "pr_title": "AI follow-up patch",
        "pr_body": "No patch bundle was available.",
        "checklist": [],
        "risks": [],
    }

    report: dict[str, Any] = {
        "bundle_path": str(bundle_path.relative_to(ROOT)),
        "bundle_safe": bool(bundle.get("safe_to_apply", False)),
        "status": "preview-only",
        "reason": "",
        "branch_name": bundle.get("branch_name", ""),
        "commit_message": bundle.get("commit_message", ""),
        "pull_request_url": "",
        "pr_title": pr_metadata["pr_title"],
    }

    if not bundle.get("safe_to_apply"):
        report["reason"] = "bundle was not marked safe_to_apply"
    elif not is_true(os.environ.get("AUTO_PR_ENABLED")):
        report["reason"] = "AUTO_PR_ENABLED is false; generated preview only"
    elif not clean_worktree():
        report["reason"] = "working tree is not clean"
    else:
        patch_text = str(bundle.get("patch", "")).strip()
        changed_files = bundle.get("changed_files") or []
        diff_stats = parse_unified_diff_stats(patch_text)
        if diff_stats.total_lines == 0 or not patch_text:
            report["reason"] = "bundle patch was empty"
        else:
            if not report["branch_name"]:
                branch_seed = slugify(bundle.get("title") or "auto-fix")
                report["branch_name"] = f"codex/ai-auto-{timestamp.replace('-', '')[:12]}-{branch_seed}"
            if not report["commit_message"]:
                report["commit_message"] = "chore: apply safe ai follow-up"

            configure_git_identity()
            apply_result = apply_patch(report["branch_name"], patch_text, changed_files, output_dir)
            if apply_result["status"] != "applied":
                report["reason"] = apply_result["reason"]
            else:
                run_git("commit", "-m", report["commit_message"], check=True)
                if os.environ.get("GITHUB_REPOSITORY") and os.environ.get("GITHUB_TOKEN"):
                    run_git("push", "--set-upstream", "origin", report["branch_name"], check=True)
                    base_branch = os.environ.get("GITHUB_REF_NAME", "").strip() or "main"
                    created_pr = create_pull_request(
                        report["branch_name"],
                        pr_metadata["pr_title"],
                        pr_metadata["pr_body"],
                        base_branch,
                    )
                    report["status"] = "pr-created"
                    report["pull_request_url"] = created_pr.get("html_url", "")
                    pr_number = int(created_pr.get("number", 0))
                    if pr_number:
                        label_pull_request(pr_number, ["ai-generated", "needs-human-review"])
                else:
                    report["status"] = "branch-created"
                    report["reason"] = "missing GitHub repository context; branch and commit created locally only"

    write_json(output_dir / "pr-result.json", {"report": report, "pr_metadata": pr_metadata})

    lines = [
        "# Auto PR Report",
        "",
        f"- Bundle: `{bundle_path.relative_to(ROOT)}`",
        f"- Status: `{report['status']}`",
        f"- Reason: {report['reason'] or '(none)'}",
        f"- Branch: `{report['branch_name'] or '(none)'}`",
        f"- Commit: `{report['commit_message'] or '(none)'}`",
    ]
    if report["pull_request_url"]:
        lines.append(f"- Pull Request: {report['pull_request_url']}")
    lines.extend(
        [
            "",
            "## PR Title",
            pr_metadata["pr_title"],
            "",
            "## PR Body",
            pr_metadata["pr_body"],
            "",
        ]
    )
    if pr_metadata["checklist"]:
        lines.extend(["## Checklist", *[f"- {item}" for item in pr_metadata["checklist"]], ""])
    if pr_metadata["risks"]:
        lines.extend(["## Risks", *[f"- {item}" for item in pr_metadata["risks"]], ""])
    write_text(output_dir / "pr-report.md", "\n".join(lines).strip() + "\n")

    write_step_summary(
        "\n".join(
            [
                "## Auto PR Loop",
                f"- Output: `{output_dir.relative_to(ROOT)}`",
                f"- Status: `{report['status']}`",
                f"- Branch: `{report['branch_name'] or '(none)'}`",
                f"- PR: {report['pull_request_url'] or '(not created)'}",
                "",
            ]
        )
    )
    set_github_outputs(output_dir=str(output_dir.relative_to(ROOT)), artifact_name=f"auto-pr-{timestamp}")
    print(output_dir)


if __name__ == "__main__":
    main()
