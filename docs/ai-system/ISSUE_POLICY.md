# Issue Policy

## Default Mode

Issue generation is report-first by default.

That means:

- the AI loop may propose issues every run
- actual GitHub issue creation stays disabled unless `AUTO_ISSUE_ENABLED=true`

## When Auto Issue Creation Is Allowed

Auto issue creation is allowed when all of the following are true:

- the title is specific and non-duplicate
- the report includes concrete impact
- the severity is at least `medium`
- the problem is actionable without hidden context
- the item is not already tracked by an open issue with the same intent

## Report-Only Cases

Keep an item as report-only when:

- the issue is vague
- the item is strategic rather than actionable
- the recommendation overlaps an existing open issue
- the issue would need broad discovery before work can start

## Severity Guide

- `critical`: main product flow broken, export impossible, or trust-damaging failure
- `high`: serious user pain, repeated failure, or likely release blocker
- `medium`: meaningful weakness with a workaround
- `low`: useful improvement but not urgent

## Duplicate Avoidance

The automation should skip creation when:

- an open issue already has the same title
- an open issue clearly covers the same bug or improvement area

Exact title matching is the minimum duplicate check. Human review should still collapse near-duplicates when needed.
