# Next Agent Brief

This file is a ready-to-use continuation brief for another coding agent.

It is intentionally written in prompt form so it can be copied into a fresh agent session with minimal editing.

## Ready-To-Paste Prompt

```md
You are continuing development on the repository `reels-automation-agent`.

This repo is already active and should NOT be rebuilt from scratch.

Your job is to continue from the current working state, preserve the existing structure, and improve the product without breaking the local-first workflow.

## First Read These Files

1. `README.md`
2. `docs/ai-system/CURRENT_STATE.md`
3. `docs/ai-system/HANDOFF_TEMPLATE.md`
4. `backend/app/services/export_service.py`
5. `backend/app/services/audio_render_service.py`
6. `backend/app/services/subtitle_service.py`
7. `backend/app/services/overlay_render_service.py`
8. `backend/app/services/shorts_story_service.py`
9. `backend/app/services/content_profile_service.py`
10. `scripts/render_caption.swift`

## Current Product Context

The product already supports:

- local upload
- YouTube watch / Shorts URL ingest
- transcript extraction
- ranked clip candidate generation
- candidate review
- vertical export
- subtitle overlays
- TTS + BGM mix
- mock publish queue

There is also a GitHub AI automation layer in the same repo.

## Current Live Local Defaults

- backend: `127.0.0.1:8875`
- frontend: `127.0.0.1:8876`

## Current Working Sample

Use project `7` and clip `28` as the current short-form tuning reference if the local DB still exists.

Useful paths:

- project detail: `http://127.0.0.1:8876/projects/7`
- clip review: `http://127.0.0.1:8876/clips/28`

## Current Known Quality Gaps

Focus on these instead of rebuilding unrelated parts:

1. short-form copy still feels heuristic
2. subtitle pacing still needs more creator-grade tuning
3. TTS is improved but still not fully natural
4. title/subtitle style presets are still too generic
5. multi-candidate export comparison is missing

## What Not To Break

- do not remove local-first flow
- do not break current API routes
- do not rip out the GitHub Actions automation layer
- do not introduce heavy cloud dependencies
- do not rewrite the whole app

## Preferred Working Style

- make focused, incremental changes
- verify with real local export where possible
- keep UI practical and creator-tool oriented
- prefer code changes over speculative architecture rewrites

## Recommended Next Tasks

Choose one of these and execute it fully:

1. add candidate-batch export for 3 to 5 clips
2. improve subtitle segmentation with beat-aware splitting
3. add sport/channel-specific short-form templates
4. improve TTS script generation so it feels more like creator narration
5. improve clip review UI for faster comparison and approval

## Validation Expectation

Before finishing:

- run relevant backend checks
- run frontend typecheck/build if frontend changed
- generate at least one real export if you touched export logic
- update docs if the workflow changed

## Final Deliverable

When you finish, summarize:

- what changed
- what was verified
- what still needs work
- which files are the new continuation points
```

## Usage Note

If the next agent is a product-focused coding agent, paste the prompt above directly.

If the next agent is mainly working on the repo automation layer, combine this file with:

- `prompts/self_improve_repo.md`

If the next agent is mainly working on product quality, combine this file with:

- `prompts/improve_system.md`
