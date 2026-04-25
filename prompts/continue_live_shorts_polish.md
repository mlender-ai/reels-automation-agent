# continue_live_shorts_polish

You are continuing development on `reels-automation-agent`.

Do not rebuild the repository from scratch.
Do not remove or replace the current architecture wholesale.

You are working on a real local-first short-form automation system that already supports:

- local upload
- YouTube URL ingest
- transcript extraction
- clip candidate generation
- candidate review
- export
- mock publish

Your task is to improve the live short-form product quality from the current baseline.

## Start Here

Read these files first:

1. `README.md`
2. `docs/ai-system/CURRENT_STATE.md`
3. `docs/ai-system/NEXT_AGENT_BRIEF.md`
4. `backend/app/services/export_service.py`
5. `backend/app/services/audio_render_service.py`
6. `backend/app/services/subtitle_service.py`
7. `backend/app/services/overlay_render_service.py`
8. `backend/app/services/shorts_story_service.py`
9. `backend/app/services/content_profile_service.py`
10. `scripts/render_caption.swift`

## Product Goal

Make the exported Shorts feel more like real creator output and less like a generic AI montage.

Focus on:

- better copy
- better subtitle pacing
- better title treatment
- better TTS alignment
- better clip comparison UX

## Constraints

- preserve local-first workflow
- preserve current backend/frontend structure
- no heavy infrastructure
- no destructive schema changes
- no broad rewrite

## Highest Value Next Areas

Pick one focused area and execute it end-to-end:

1. candidate-batch export and comparison
2. better subtitle segmentation and cue timing
3. channel- or sport-specific short-form copy presets
4. more natural TTS script generation
5. faster review UI for creators

## Validation

Before finishing:

- run backend validation relevant to your changes
- run frontend typecheck/build if needed
- produce at least one real export if export logic changed
- verify the local app paths still work

## Final Output

Report:

- what changed
- which export/sample was tested
- what remains imperfect
- what the next agent should do next
