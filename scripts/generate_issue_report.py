from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import Any

from automation_common import (
    REPORTS_DIR,
    ROOT,
    AutomationError,
    ensure_dir,
    ensure_github_labels,
    extract_json_payload,
    github_api_request,
    is_true,
    latest_subdir,
    load_prompt,
    read_text,
    set_github_outputs,
    utc_timestamp,
    write_json,
    write_step_summary,
    write_text,
)
from common_llm import call_chat_completion


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate issue candidates from the latest agent loop output.")
    parser.add_argument(
        "--agent-run",
        default="",
        help="Optional explicit path to an agent run directory. Defaults to the latest run under reports/agent-runs.",
    )
    parser.add_argument(
        "--output-root",
        default=str(REPORTS_DIR / "issues"),
        help="Directory that stores timestamped issue report outputs.",
    )
    return parser.parse_args()


def should_create_issue(priority: str, body: str, explicit_value: Any) -> bool:
    normalized_priority = priority.strip().lower()
    if explicit_value is True:
        return True
    if normalized_priority in {"critical", "high"}:
        return True
    if normalized_priority == "medium" and len(body.strip()) >= 80:
        return True
    return False


def normalize_issues(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, dict) and isinstance(payload.get("issues"), list):
        raw_issues = payload["issues"]
    elif isinstance(payload, list):
        raw_issues = payload
    elif isinstance(payload, dict):
        raw_issues = [payload]
    else:
        raise AutomationError("Issue writer response was not valid JSON")

    issues: list[dict[str, Any]] = []
    for index, item in enumerate(raw_issues, start=1):
        if not isinstance(item, dict):
            continue
        title = str(item.get("title", "")).strip()
        body = str(item.get("body", "")).strip()
        if not title or not body:
            continue
        labels = item.get("labels") or []
        if not isinstance(labels, list):
            labels = [str(labels)]
        source_roles = item.get("source_roles") or []
        if not isinstance(source_roles, list):
            source_roles = [str(source_roles)]
        issues.append(
            {
                "title": title,
                "body": body,
                "labels": [str(label).strip() for label in labels if str(label).strip()],
                "priority": str(item.get("priority", "medium")).strip().lower() or "medium",
                "source_roles": [str(role).strip() for role in source_roles if str(role).strip()],
                "create_issue": should_create_issue(
                    str(item.get("priority", "medium")).strip().lower() or "medium",
                    body,
                    item.get("create_issue"),
                ),
                "creation_status": "report-only",
                "order": index,
            }
        )
    return issues[:5]


def latest_agent_run(agent_run_arg: str) -> Path:
    if agent_run_arg:
        path = Path(agent_run_arg)
        return path if path.is_absolute() else (ROOT / path).resolve()
    return latest_subdir(REPORTS_DIR / "agent-runs")


def fetch_open_issue_titles() -> set[str]:
    repository = os.environ.get("GITHUB_REPOSITORY", "").strip()
    if not repository:
        return set()
    data = github_api_request(method="GET", path=f"/repos/{repository}/issues?state=open&per_page=100")
    if not isinstance(data, list):
        return set()
    return {str(item.get("title", "")).strip() for item in data if isinstance(item, dict)}


def create_issue(issue: dict[str, Any]) -> dict[str, Any]:
    repository = os.environ["GITHUB_REPOSITORY"]
    labels = list(dict.fromkeys(issue["labels"] + ["ai-generated", "needs-human-review"]))
    ensure_github_labels(labels)
    return github_api_request(
        method="POST",
        path=f"/repos/{repository}/issues",
        payload={
            "title": issue["title"],
            "body": issue["body"],
            "labels": labels,
        },
    )


def main() -> None:
    args = parse_args()
    agent_run = latest_agent_run(args.agent_run)
    prompt_text = load_prompt(".github/prompts/issue-writer.md")
    issue_policy = read_text(ROOT / "docs" / "ai-system" / "ISSUE_POLICY.md", limit=6000)

    user_prompt = "\n\n".join(
        [
            prompt_text,
            "# Issue Policy",
            issue_policy,
            "# QA Report",
            read_text(agent_run / "qa.md"),
            "# PO Report",
            read_text(agent_run / "po.md"),
            "# PM Report",
            read_text(agent_run / "pm.md"),
            "# CTO Report",
            read_text(agent_run / "cto.md"),
        ]
    )
    raw_response = call_chat_completion(
        system_prompt="You draft GitHub issue candidates for reels-automation-agent. Return JSON only.",
        user_prompt=user_prompt,
        max_tokens=2200,
    )
    issues = normalize_issues(extract_json_payload(raw_response))

    created_count = 0
    if is_true(os.environ.get("AUTO_ISSUE_ENABLED")) and os.environ.get("GITHUB_REPOSITORY"):
        existing_titles = fetch_open_issue_titles()
        for issue in issues:
            if not issue["create_issue"]:
                issue["creation_status"] = "report-only"
                continue
            if issue["title"] in existing_titles:
                issue["creation_status"] = "duplicate-skipped"
                continue
            created = create_issue(issue)
            issue["creation_status"] = "created"
            issue["issue_url"] = created.get("html_url", "")
            created_count += 1

    timestamp = utc_timestamp()
    output_dir = ensure_dir(Path(args.output_root) / timestamp)
    write_json(
        output_dir / "issues.json",
        {
            "agent_run": str(agent_run.relative_to(ROOT)),
            "issues": issues,
        },
    )

    lines = [
        "# Issue Report",
        "",
        f"- Source agent run: `{agent_run.relative_to(ROOT)}`",
        f"- Candidate count: {len(issues)}",
        f"- Created issues: {created_count}",
        "",
    ]
    for issue in issues:
        lines.extend(
            [
                f"## {issue['title']}",
                f"- Priority: `{issue['priority']}`",
                f"- Labels: {', '.join(issue['labels']) or '(none)'}",
                f"- Source Roles: {', '.join(issue['source_roles']) or '(unspecified)'}",
                f"- Status: `{issue['creation_status']}`",
            ]
        )
        if issue.get("issue_url"):
            lines.append(f"- GitHub: {issue['issue_url']}")
        lines.extend(["", issue["body"], ""])
    write_text(output_dir / "issues.md", "\n".join(lines).strip() + "\n")

    write_step_summary(
        "\n".join(
            [
                "## Issue Loop",
                f"- Output: `{output_dir.relative_to(ROOT)}`",
                f"- Candidates: {len(issues)}",
                f"- Created: {created_count}",
                "",
            ]
        )
    )
    set_github_outputs(output_dir=str(output_dir.relative_to(ROOT)), artifact_name=f"issue-report-{timestamp}")
    print(output_dir)


if __name__ == "__main__":
    main()
