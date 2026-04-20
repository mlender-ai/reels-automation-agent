from __future__ import annotations

import sys
import unittest
from pathlib import Path

from fastapi import HTTPException

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.clip_scoring_service import generate_ranked_candidate_windows  # noqa: E402
from app.services.content_profile_service import CONTENT_PROFILE_COMBAT_SPORTS, detect_content_profile_from_text  # noqa: E402
from app.services.metadata_generation_service import DEFAULT_METADATA_GENERATOR  # noqa: E402
from app.services.validation_service import ensure_transcript_segments_available, normalize_transcript_segments  # noqa: E402


def make_segments() -> list[dict]:
    return [
        {"id": 0, "start": 0.0, "end": 3.6, "text": "First, this is the key mistake creators make when they clip too late."},
        {"id": 1, "start": 3.8, "end": 7.2, "text": "You lose the hook in the first three seconds and the whole short falls flat."},
        {"id": 2, "start": 7.4, "end": 11.1, "text": "The second problem is weak comparison because viewers cannot see the before and after."},
        {"id": 3, "start": 11.4, "end": 14.8, "text": "That is why the decisive line has to appear early and cleanly."},
        {"id": 4, "start": 15.1, "end": 18.6, "text": "If you show the core moment first, retention climbs and the title writes itself."},
        {"id": 5, "start": 18.8, "end": 22.4, "text": "Number three is subtitle readability because tiny captions kill the best clip."},
        {"id": 6, "start": 22.6, "end": 26.2, "text": "A bold opening, one clear idea, and a strong ending usually beat complicated edits."},
        {"id": 7, "start": 26.5, "end": 30.1, "text": "This is the part most teams miss when they export vertical video too early."},
        {"id": 8, "start": 30.4, "end": 34.0, "text": "Once the transcript is usable, candidate scoring becomes much more reliable."},
        {"id": 9, "start": 34.3, "end": 38.1, "text": "Then your approval queue becomes smaller, faster, and easier to trust."},
        {"id": 10, "start": 38.5, "end": 42.2, "text": "That single workflow change is often the difference between chaos and consistency."},
        {"id": 11, "start": 42.5, "end": 46.0, "text": "So if you want better shorts, start with cleaner hooks and clearer endings."},
    ]


class TranscriptNormalizationTests(unittest.TestCase):
    def test_normalize_transcript_segments_sorts_and_deduplicates(self) -> None:
        raw_segments = [
            {"id": 10, "start": 4.2, "end": 6.1, "text": "Second line"},
            {"id": 9, "start": 0.0, "end": 2.0, "text": "First line"},
            {"id": 11, "start": 4.2, "end": 6.1, "text": "Second line"},
            {"id": 12, "start": 7.0, "end": 7.0, "text": "bad"},
            {"id": 13, "start": 7.3, "end": 9.0, "text": "   "},
        ]
        normalized = normalize_transcript_segments(raw_segments)
        self.assertEqual(len(normalized), 2)
        self.assertEqual([segment["text"] for segment in normalized], ["First line", "Second line"])

    def test_ensure_transcript_segments_available_rejects_empty_input(self) -> None:
        with self.assertRaises(HTTPException) as context:
            ensure_transcript_segments_available([])
        self.assertEqual(context.exception.status_code, 422)
        self.assertIn("empty or invalid", str(context.exception.detail))


class ClipGenerationWindowTests(unittest.TestCase):
    def test_generate_ranked_candidate_windows_returns_unique_valid_windows(self) -> None:
        windows = generate_ranked_candidate_windows(make_segments())
        self.assertGreaterEqual(len(windows), 3)
        self.assertLessEqual(len(windows), 5)
        self.assertTrue(all(8.0 <= window.duration <= 45.0 for window in windows))
        self.assertEqual(len({(round(window.start_time, 1), round(window.end_time, 1)) for window in windows}), len(windows))
        self.assertTrue(all(window.hook_text for window in windows))
        self.assertTrue(all(window.suggested_title for window in windows))

    def test_generate_ranked_candidate_windows_rejects_low_signal_transcript(self) -> None:
        low_signal = [{"id": 1, "start": 0.0, "end": 1.5, "text": "Hi there"}]
        with self.assertRaises(HTTPException) as context:
            generate_ranked_candidate_windows(low_signal)
        self.assertEqual(context.exception.status_code, 422)
        self.assertIn("usable speech", str(context.exception.detail))

    def test_combat_sports_profile_detects_and_generates_domain_specific_metadata(self) -> None:
        segments = [
            {"id": 0, "start": 0.0, "end": 4.0, "text": "The feint opens the angle and the left hook drops the fighter immediately."},
            {"id": 1, "start": 4.2, "end": 8.3, "text": "That knockout only happens because the guard comes back late after the jab."},
            {"id": 2, "start": 8.6, "end": 13.8, "text": "If you break down the exchange, the timing and distance management decide everything."},
            {"id": 3, "start": 14.0, "end": 18.7, "text": "The referee waves it off fast because the counter lands clean again at the fence."},
        ]
        profile = detect_content_profile_from_text(" ".join(segment["text"] for segment in segments))
        self.assertEqual(profile, CONTENT_PROFILE_COMBAT_SPORTS)

        metadata = DEFAULT_METADATA_GENERATOR.generate(segments, " ".join(segment["text"] for segment in segments))
        self.assertIn("#mma", metadata.suggested_hashtags)
        self.assertTrue(
            any(fragment in metadata.suggested_title.lower() for fragment in ["fight", "exchange", "caught", "finish"])
        )
