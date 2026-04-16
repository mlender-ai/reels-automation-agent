# Master Prompt Order

This repository uses two prompt families:

- `/prompts/*.md` for build and improvement sessions
- `/.github/prompts/*.md` for autonomous review and follow-up generation

## Build-Time Prompt Order

### 1. `build_mvp`

Use to establish or rebuild the local-first product path:

- project create
- video upload
- transcript extraction
- clip candidate generation
- approval / rejection
- export
- mock publish queue

### 2. `improve_system`

Use to stabilize the product and tighten quality:

- broken flow fixes
- UI/UX cleanup
- service boundary hardening
- README and runbook alignment

### 3. `scale_system`

Use to extend the system without breaking local-first constraints:

- better adapter architecture
- smarter scoring and metadata generation
- stronger job orchestration
- real platform integration prep

### 4. `self_improve_repo`

Use to improve the repository itself:

- issue generation quality
- patch bundle safety
- PR automation guardrails
- workflow observability

## Automation Prompt Order

1. `qa`
2. `po`
3. `pm`
4. `cto`
5. `issue-writer`
6. `patch-writer`
7. `pr-writer`

The automation prompts should only graduate from report generation to code changes when issue and PR policy allow it.
