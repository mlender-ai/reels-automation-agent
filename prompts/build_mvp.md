# build_mvp

Build the first complete version of `reels-automation-agent`.

## Objective

Create a local-first shortform automation system that supports:

- local video upload
- transcript extraction with `faster-whisper`
- 3 to 5 clip candidates
- approval and rejection workflow
- vertical export with burned-in subtitles
- mock publish queue for future platform adapters

## Required Stack

- backend: Python + FastAPI + SQLite
- frontend: React + Vite + TypeScript + Tailwind
- video: FFmpeg
- AI: `faster-whisper`

## Product Rules

- local files only
- no platform download support
- no paid API required for the core flow
- UI must feel like a real internal creator tool
- backend and frontend must both run locally

## Deliverables

- executable backend
- executable frontend
- project and clip workflow
- README with setup instructions
- file organization that supports later platform publishing

## Quality Bar

- do not leave the main path as TODOs
- use mock adapters only where real integrations are intentionally deferred
- keep the implementation simple enough to run on a normal laptop
