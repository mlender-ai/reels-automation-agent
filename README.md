# reels-automation-agent

`reels-automation-agent` is a local-first shortform automation product plus a GitHub-based self-improving AI development system.

It has four layers:

1. Product Layer
2. AI Org Layer
3. Automation Layer
4. Auto-PR Layer

The product turns a locally uploaded long-form video into reviewable short clips, subtitle-burned vertical exports, and mock publish jobs.

The automation system continuously reviews the repository, drafts issues, proposes safe patch bundles, and can open draft pull requests for small bounded fixes. Human review remains the final approval boundary.

This repository does not download videos from external platforms. Version one is strictly local-upload based.

## Current Goal

This repository is the basecamp for two tracks that evolve together:

1. a local-first shortform automation app for upload, transcript, clip generation, approval, export, and mock publish
2. an AI operating system that reviews the repo, writes reports, drafts issues, proposes small patch bundles, and opens draft PRs only when explicitly allowed

## Product Features

- project creation
- local video upload
- transcript extraction with `faster-whisper`
- clip candidate generation
- candidate editing
- approve / reject workflow
- vertical `1080x1920` export with burned-in subtitles
- mock publish queue for YouTube Shorts / Instagram Reels / TikTok adapter structure

## AI Org Features

- QA role for bugs, regressions, and auto-fix candidates
- PO role for user value and UX prioritization
- PM role for execution planning
- CTO role for architecture and debt review
- issue-writer for issue candidates
- patch-writer for safe patch bundles
- pr-writer for draft PR summaries

## Automation Features

- hourly agent loop
- issue report generation
- optional GitHub issue creation
- safe auto-PR pipeline for small changes
- CI for backend quality, frontend type-check, and frontend build

## Repository Structure

```text
reels-automation-agent/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── db/
│   │   ├── models/
│   │   ├── prompts/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── workers/
│   │   └── main.py
│   ├── data/
│   ├── .env.example
│   └── requirements.txt
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── postcss.config.js
├── docs/
│   └── ai-system/
│       ├── README.md
│       ├── AGENTS.md
│       ├── CONVENTIONS.md
│       ├── MASTER_PROMPTS.md
│       ├── ISSUE_POLICY.md
│       ├── PR_POLICY.md
│       └── HANDOFF_TEMPLATE.md
├── .github/
│   ├── prompts/
│   │   ├── qa.md
│   │   ├── po.md
│   │   ├── pm.md
│   │   ├── cto.md
│   │   ├── issue-writer.md
│   │   ├── patch-writer.md
│   │   └── pr-writer.md
│   └── workflows/
│       ├── agent-loop.yml
│       ├── issue-loop.yml
│       ├── auto-pr-loop.yml
│       └── ci.yml
├── prompts/
│   ├── build_mvp.md
│   ├── improve_system.md
│   ├── scale_system.md
│   └── self_improve_repo.md
├── scripts/
│   ├── automation_common.py
│   ├── common_llm.py
│   ├── run_agent_loop.py
│   ├── generate_issue_report.py
│   ├── generate_patch_bundle.py
│   └── create_auto_pr.py
└── README.md
```

## Local Product Run

### Prerequisites

- Python 3.11+
- Node.js 18+
- `ffmpeg` and `ffprobe` on `PATH`

### FFmpeg install

macOS:

```bash
brew install ffmpeg
```

Ubuntu / Debian:

```bash
sudo apt update
sudo apt install ffmpeg
```

Verify:

```bash
ffmpeg -version
ffprobe -version
```

### Backend run

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Key backend env vars:

- `RAA_DATABASE_URL`
- `RAA_FRONTEND_ORIGIN`
- `RAA_WHISPER_MODEL_SIZE`
- `RAA_WHISPER_DEVICE`
- `RAA_WHISPER_COMPUTE_TYPE`
- `RAA_FFMPEG_BINARY`
- `RAA_FFPROBE_BINARY`

### Frontend run

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Default frontend env:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

### Non-conflicting ports

```bash
# backend
cd backend
RAA_FRONTEND_ORIGIN=http://127.0.0.1:8766 uvicorn app.main:app --host 127.0.0.1 --port 8765

# frontend
cd frontend
VITE_API_BASE_URL=http://127.0.0.1:8765 npm run dev -- --host 127.0.0.1 --port 8766
```

## Whisper Notes

- the first transcription may download model weights locally
- the default configuration is CPU-friendly: `base` + `cpu` + `int8`
- long files on CPU will be slower, but the system stays local-first and near-zero cost

## Local Workflow

1. Start backend and frontend.
2. Create a project and upload a local video.
3. Extract the transcript.
4. Generate clip candidates.
5. Review one candidate and approve or reject it.
6. Export a vertical MP4.
7. Review the export.
8. Queue a mock publish job.

Optional demo seed:

```bash
cd backend
python3 app/utils/seed_demo.py --title "Demo Reels Project"
```

## AI Organization

Primary docs:

- `docs/ai-system/README.md`
- `docs/ai-system/AGENTS.md`
- `docs/ai-system/ISSUE_POLICY.md`
- `docs/ai-system/PR_POLICY.md`
- `docs/ai-system/HANDOFF_TEMPLATE.md`

The AI roles are:

- QA
- PO
- PM
- CTO
- issue-writer
- patch-writer
- pr-writer

## Automation Scripts

- `python scripts/run_agent_loop.py`
- `python scripts/generate_issue_report.py`
- `python scripts/generate_patch_bundle.py`
- `python scripts/create_auto_pr.py`

These scripts use an OpenAI-compatible Chat Completions API through `scripts/common_llm.py` and store their outputs under `reports/`.
By default, the workflows can fall back to GitHub Models with `GITHUB_TOKEN` if the AI configuration secrets are unset.

## GitHub Actions

### `agent-loop.yml`

- runs hourly or manually
- generates QA / PO / PM / CTO markdown reports
- stores role reports under `reports/{role}/`
- saves artifacts and step summaries

### `issue-loop.yml`

- runs the agent loop
- drafts issue candidates
- can create GitHub issues when allowed by policy and secrets

### `auto-pr-loop.yml`

- runs the agent loop
- generates a patch bundle from safe auto-fix candidates
- creates a branch, commit, and draft PR only when allowed

### `ci.yml`

- lints backend and scripts with `ruff`
- compiles backend and scripts
- type-checks frontend
- builds frontend

## Required GitHub Secrets

- `AI_API_URL`
- `AI_API_KEY`
- `AI_MODEL`
- `AI_TEMPERATURE`
- `AUTO_PR_ENABLED`
- `AUTO_ISSUE_ENABLED`
- `GITHUB_TOKEN`

`GITHUB_TOKEN` can use the built-in GitHub Actions token as long as workflow permissions allow the operation.

Recommended baseline values for this repository:

- `AI_API_URL=https://models.github.ai/inference/chat/completions`
- `AI_API_KEY=USE_GITHUB_TOKEN`
- `AI_MODEL=openai/gpt-4.1`
- `AI_TEMPERATURE=0.2`
- `AUTO_PR_ENABLED=false`
- `AUTO_ISSUE_ENABLED=false`

Secrets must be configured before the 24-hour agent loop can actually call an LLM. Without them, the workflows still run, but AI generation steps can fail.

## Auto PR Policy

- auto merge is disabled by default
- automatic changes are limited to small, bounded fixes
- maximum changed files: 5
- maximum diff lines: 220
- human review is required before merge

Detailed rules live in `docs/ai-system/PR_POLICY.md`.

## What Is Real Today

- the local shortform product flow
- transcript extraction
- clip generation
- review and export
- mock publish queue
- AI loop report generation
- issue candidate generation
- patch bundle generation
- guarded branch / commit / draft PR creation

## What Is Still Mock Or Deferred

- real YouTube Shorts upload
- real Instagram Reels upload
- real TikTok upload
- automatic merge
- large-scope autonomous refactors

## Future Expansion

- official platform adapters
- smarter metadata generation with optional LLM support
- smarter crop / face tracking
- richer issue deduplication
- more selective patch candidate ranking
- tighter CI validation before auto PR creation

## Next Steps

- trigger `Agent Loop` first and verify that fresh artifacts appear under `reports/`
- use `prompts/build_mvp.md` for the next product build pass
- use `prompts/improve_system.md` to harden the generated MVP
- use `prompts/scale_system.md` when official platform adapters are ready
- use `prompts/self_improve_repo.md` to refine the repo's own AI operating loop
