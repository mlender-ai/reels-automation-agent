from __future__ import annotations

import sys
import unittest
from pathlib import Path

from fastapi import HTTPException

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.youtube_ingest_service import _normalize_youtube_url  # noqa: E402


class YouTubeIngestServiceTests(unittest.TestCase):
    def test_accepts_watch_url(self) -> None:
        normalized = _normalize_youtube_url("https://www.youtube.com/watch?v=abc123xyz")
        self.assertEqual(normalized, "https://www.youtube.com/watch?v=abc123xyz")

    def test_accepts_shorts_url(self) -> None:
        normalized = _normalize_youtube_url("https://www.youtube.com/shorts/abc123xyz")
        self.assertEqual(normalized, "https://www.youtube.com/shorts/abc123xyz")

    def test_rejects_non_youtube_host(self) -> None:
        with self.assertRaises(HTTPException) as context:
            _normalize_youtube_url("https://vimeo.com/1234")
        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("Only YouTube video URLs", str(context.exception.detail))

    def test_rejects_watch_url_without_video_id(self) -> None:
        with self.assertRaises(HTTPException) as context:
            _normalize_youtube_url("https://www.youtube.com/watch")
        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("missing a video id", str(context.exception.detail))
