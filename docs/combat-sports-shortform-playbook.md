# Combat Sports Shortform Playbook

As of April 20, 2026, this repository is being tuned for MMA, boxing, kickboxing, Muay Thai, and general fight-content workflows.

## What We Are Benchmarking

### Candidate reference accounts

- UFC official YouTube channel: [UFC on Social Blade](https://socialblade.com/youtube/handle/ufc)
  - Search result snapshot showed about 22.1M subscribers and about 11.2B views in mid-April 2026.
- ONE Championship official YouTube channel: [ONE Championship on Social Blade](https://socialblade.com/youtube/handle/onechampionship/achievements)
  - Search result snapshot showed about 12.6M subscribers and about 9.4B views.
- Top Rank Boxing YouTube channel: [Top Rank Boxing on Social Blade](https://socialblade.com/youtube/c/toprank)
  - Search result snapshot showed about 3.3M subscribers and about 1.4B views.
- Personality-led MMA creator model: [MMA Fighting on Renato Moicano’s YouTube growth](https://www.mmafighting.com/ufc/479760/from-ufc-fighter-to-youtube-sensation-renato-moicano-aims-to-take-over-the-internet)
  - The April 4, 2026 article describes strong traction from live reaction and opinion-led MMA content.

### Example combat-sports Short to study

- ONE Championship Short: [Built DIFFERENT 😤](https://www.youtube.com/watch?v=JzIL2fPrOFo)
  - Published May 15, 2024.
  - Search result snapshot showed about 26.9M views as of April 2026.

## Platform Inputs We Should Respect

- YouTube Shorts can be up to 3 minutes if uploaded as vertical or square video and uploaded after October 15, 2024: [Understand three-minute YouTube Shorts](https://support.google.com/youtube/answer/15424877?hl=en)
- YouTube says Shorts recommendations are based on performance and viewer personalization, not a preferred content format: [Search & discovery tips](https://support.google.com/youtube/answer/11914225?co=YOUTUBE._YTVideoType%3Dshorts&hl=en)
- TikTok’s sports partnership material says 85% of fans use TikTok as a second-screen experience during live events and 90% take an off-platform action after viewing sports content: [TikTok GamePlan](https://newsroom.tiktok.com/tiktok-gameplan-harness-the-power-of-tiktoks-sports-community?lang=en&trk=article-ssr-frontend-pulse_little-text-block)

## Format Packs To Copy

These are inference-based format packs built from the sources above plus the visible patterns on official fight channels.

### 1. Decisive Exchange

- Best length: 12s to 22s
- Open on impact or the half-second before impact
- Use only one exchange
- End on reaction, referee intervention, or replay freeze
- Title pattern:
  - `The exact moment the fight flipped`
  - `He got caught clean here`
  - `This finish changed everything`

### 2. Fast Breakdown

- Best length: 18s to 32s
- Start on the fake, setup, or positioning mistake
- Subtitle style should make one tactical idea obvious
- Use one sentence of explanation, not full commentary
- Title pattern:
  - `Why this exchange changed the fight`
  - `The small mistake that cost him`
  - `What coaches notice in this sequence`

### 3. Round Swing / Momentum Flip

- Best length: 18s to 30s
- Show the momentum turn, not the whole round
- Keep the transition obvious: before pressure, after pressure
- Title pattern:
  - `One exchange changed the whole round`
  - `This round swung in seconds`
  - `Momentum flipped right here`

### 4. Reaction / Debate Clip

- Best length: 15s to 35s
- Good for scorecards, stoppages, fouls, controversial moments
- Use crowd sound, corner reaction, face reaction, or commentator spike
- Title pattern:
  - `Why fans argued over this moment`
  - `Was this stoppage too early?`
  - `The sequence everyone is debating`

### 5. Personality-Led Fight Commentary

- Best length: 25s to 45s
- More creator-led than pure highlight
- Inspired by the success of reaction-style MMA creators like Moicano
- Use sparingly in the first MVP, but keep the structure ready

## How The App Should Cut Combat Sports

- Prefer shorter windows than general talk-head content
- Reward transcript windows that contain:
  - knockout and submission language
  - round and momentum language
  - tactical explanation words like timing, angle, distance, setup
  - coach or corner context
- Penalize windows that:
  - start after the key fake or setup already happened
  - run too long after the finish
  - include too much dead reset footage

## Zero-Cost Operating Rules

- Keep transcription local with `faster-whisper`
- Keep export local with `ffmpeg`
- Keep publish mock-only until account strategy is decided
- Use royalty-free or fully owned music only
  - For YouTube, claimed content over one minute can affect Shorts availability: [Understand three-minute YouTube Shorts](https://support.google.com/youtube/answer/15424877?hl=en)

## Immediate Next Production Setup

- Use the current combat-sports heuristic profile in the scorer
- Seed preview examples from `backend/data/seed/combat_sports_demo_transcript.json`
- Generate a markdown preview with:
  - `python3 backend/app/utils/generate_combat_preview.py`
- When a real local fight video is uploaded, review:
  - top 3 shortest decisive clips
  - top 2 tactical breakdown clips
