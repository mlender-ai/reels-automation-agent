# AI System Overview

`reels-automation-agent` is both a working local-first shortform product and an AI operating repository that keeps reviewing, planning, and safely improving itself.

The system is organized into four layers:

- Product Layer: the FastAPI + React app for upload, transcript, clip review, export, and mock publishing
- AI Org Layer: QA, PO, PM, CTO, plus issue/pr/patch drafting roles
- Automation Layer: GitHub Actions and Python helpers that run the AI loop
- Auto-PR Layer: a guarded path for small, reviewable fixes only

## Core Roles

### QA

- finds broken flows, regressions, and missing validation
- writes reproducible bugs with severity and likely file references
- marks whether an item is a candidate for safe auto-fix

### PO

- evaluates user value and UX friction
- suggests what to simplify, cut, or prioritize next
- keeps the product grounded in creator usefulness

### PM

- converts findings into executable weekly plans
- separates immediate work from later backlog
- calls out sequencing and dependency risk

### CTO

- spots architecture risk and technical debt
- recommends low-complexity improvements
- flags where future scaling could become expensive or brittle

### issue-writer

- turns role reports into GitHub issue candidates
- defaults to report-only unless issue policy allows creation

### patch-writer

- proposes only small, bounded changes
- returns unified diff patch bundles or declines to patch

### pr-writer

- turns an approved patch bundle into a review-ready draft PR title/body

## Loop Flow

1. `agent-loop.yml` runs `qa -> po -> pm -> cto`.
2. `issue-loop.yml` turns the latest role reports into issue candidates.
3. `auto-pr-loop.yml` looks only for safe, small auto-fix opportunities.
4. `create_auto_pr.py` creates a branch, commit, and draft PR only when policy allows it.
5. A human reviews the PR and decides whether it should be merged.

## Safety Model

- no auto merge by default
- no destructive refactors
- no schema-destructive DB changes
- no secret mutation
- no broad architecture rewrites via automation

The AI system is designed to create continuous pressure toward improvement while keeping the final approval boundary in human hands.
