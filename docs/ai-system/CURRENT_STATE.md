# Current Repo State

This document is the concrete handoff snapshot for the current repository state.

For a ready-to-paste continuation prompt, also open:

- `docs/ai-system/NEXT_AGENT_BRIEF.md`

## Product State

The local app is actively working with these flows:

- create project
- upload local video
- ingest a user-supplied YouTube watch or Shorts URL
- extract transcript
- generate ranked clip candidates
- edit / approve / reject candidates
- export a `1080x1920` short-form MP4
- queue a mock publish job

The current product is not just a scaffold. It has been iterated through multiple real export passes and style revisions.

## What Is Working Now

- FastAPI backend on local SQLite
- React + Vite frontend
- local file storage under `backend/data/projects/*`
- `faster-whisper` transcript extraction
- heuristic clip scoring and metadata generation
- background workflow jobs with polling
- local export pipeline with:
  - top title overlay
  - subtitle overlay
  - TTS voiceover
  - BGM bed
  - mixed audio output
- GitHub AI loop with issue and patch generation structure

## Most Relevant Recent Product Work

Recent work focused on the short-form export path:

- YouTube URL ingest added to the product flow
- title overlays made persistent and simpler
- subtitle cues shortened and rewritten for better Shorts rhythm
- TTS moved to male voice preference
- TTS generation aligned to subtitle cues instead of a separate analysis paragraph
- combat-sports copy tuned to feel more like boxing / fight content instead of generic AI analysis

## Current Default Local Ports

- backend: `http://127.0.0.1:8875`
- frontend: `http://127.0.0.1:8876`

## Example Live Paths Used During Recent Development

These are useful for sanity-checking the current app state if local data has not been reset:

- new project page: `http://127.0.0.1:8876/projects/new`
- project 7 detail: `http://127.0.0.1:8876/projects/7`
- project 7 clips: `http://127.0.0.1:8876/projects/7/clips`
- clip 28 review: `http://127.0.0.1:8876/clips/28`

Recent export asset produced during tuning:

- `backend/data/projects/7/exports/clip-28-asset-20260425095950.mp4`

## Files Most Likely To Matter Next

Backend export / styling:

- `backend/app/services/export_service.py`
- `backend/app/services/audio_render_service.py`
- `backend/app/services/subtitle_service.py`
- `backend/app/services/overlay_render_service.py`
- `backend/app/services/shorts_story_service.py`
- `backend/app/services/content_profile_service.py`
- `scripts/render_caption.swift`

Frontend review flow:

- `frontend/src/pages/ClipReviewPage.tsx`
- `frontend/src/pages/CandidateClipsPage.tsx`
- `frontend/src/pages/ProjectDetailPage.tsx`

Automation / AI org:

- `.github/workflows/agent-loop.yml`
- `.github/workflows/issue-loop.yml`
- `.github/workflows/auto-pr-loop.yml`
- `scripts/run_agent_loop.py`
- `scripts/generate_issue_report.py`
- `scripts/generate_patch_bundle.py`
- `scripts/create_auto_pr.py`

## Current Quality Gaps

The app works, but another agent should understand the open quality gaps clearly:

1. short-form headline and subtitle copy is still heuristic and can feel generic
2. TTS timing is much better than before, but it is still cue-level alignment rather than precise narration editing
3. subtitle segmentation needs more channel-style tuning for real creator polish
4. combat sports is the most tuned category; other sports are modeled but not equally polished
5. candidate generation and export comparison should become more batch-oriented

## Safe Next Tasks

These are strong next tasks for another agent:

1. build channel-specific short-form copy templates
2. add export comparison for multiple candidate clips
3. improve subtitle segmentation with punctuation- and beat-aware splitting
4. add style presets per sport / creator persona
5. improve ingest validation and source-type handling

## Things To Avoid Breaking

- local-first flow
- existing project / clip / export API routes
- GitHub automation safety guardrails
- background workflow job status flow
- current ports and run instructions unless there is a strong reason

## Quick Start For Another Agent

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
RAA_FRONTEND_ORIGIN=http://127.0.0.1:8876 python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8875
```

```bash
cd frontend
npm install
VITE_API_BASE_URL=http://127.0.0.1:8875 npm run dev -- --host 127.0.0.1 --port 8876
```

Then open:

- `http://127.0.0.1:8876/`

## Last Important Git Commits

Recent useful markers:

- `d167e55` add YouTube URL ingest workflow
- `293260b` realign shorts title, subtitle, and TTS
- `e10bcad` refine male voice, combat copy, and white-text short-form style
