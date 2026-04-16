# Conventions

## Git Rules

- keep `main` deployable and readable
- use short-lived feature branches
- merge intentionally after basic validation
- never mix unrelated refactors with feature work unless the refactor is required for the change
- automated PRs must stay small, reviewable, and reversible

## Branch Strategy

- `main`: stable trunk
- `feature/*`: feature delivery
- `fix/*`: bug fixes
- `docs/*`: documentation and AI operating docs
- `ops/*`: workflow, automation, and CI changes
- `codex/ai-auto-*`: machine-generated safe follow-up branches

## Commit Rules

Use a concise subject that explains outcome, not effort.

Recommended formats:

- `feat: add clip export retry handling`
- `fix: stabilize publish queue status updates`
- `docs: define qa po pm cto operating contract`
- `ops: add hourly agent loop workflow`

## Definition Of Done

Work is done when all of the following are true:

- the core behavior works locally
- the change matches the documented workflow
- error states are handled reasonably
- naming and structure are consistent
- obvious regressions were checked
- the README or relevant docs are updated if behavior changed
- auto-generated changes include a human review handoff

## Code Structure Principles

- keep API and service layers clearly separated
- prefer direct, readable modules over heavy abstraction
- isolate external tool calls such as FFmpeg and model inference behind service functions
- keep file-path logic centralized
- store state needed for recovery in SQLite or the local filesystem
- design interfaces so mock adapters can later be replaced by real platform integrations
- keep automation helpers in Python instead of large shell scripts

## Product Principles

- local-first by default
- zero-cost runtime assumptions when possible
- approval before publish
- explicit status transitions
- graceful handling for missing files, failed exports, and unavailable tools

## Documentation Principles

- docs should match code, not aspirations
- prompts should be reusable and role-specific
- workflow automation should be inspectable from the repo itself

## AI Loop Principles

- every automated report should be understandable by a human without extra hidden context
- preserve role separation so QA does not become PM and CTO does not become PO
- prefer consistent markdown outputs over clever formatting
- automation must fail closed when safety rules are unclear
