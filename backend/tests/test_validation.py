from __future__ import annotations

import sys
import unittest
from pathlib import Path

from fastapi import HTTPException

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.validation_service import (  # noqa: E402
    MAX_CLIP_DURATION_SECONDS,
    MIN_CLIP_DURATION_SECONDS,
    validate_clip_window,
    validate_video_upload,
)


class UploadValidationTests(unittest.TestCase):
    def test_accepts_supported_video_file(self) -> None:
        validate_video_upload("episode.mp4", "video/mp4", 12 * 1024 * 1024)

    def test_rejects_unsupported_content_type(self) -> None:
        with self.assertRaises(HTTPException) as context:
            validate_video_upload("episode.mp4", "text/plain", 512)
        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("Unsupported upload content type", str(context.exception.detail))

    def test_rejects_unsupported_extension(self) -> None:
        with self.assertRaises(HTTPException) as context:
            validate_video_upload("episode.txt", "text/plain", 512)
        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("Unsupported video file type", str(context.exception.detail))

    def test_rejects_oversized_upload(self) -> None:
        with self.assertRaises(HTTPException) as context:
            validate_video_upload("episode.mov", "video/quicktime", 3 * 1024 * 1024 * 1024)
        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("size limit", str(context.exception.detail))


class ClipValidationTests(unittest.TestCase):
    def test_accepts_reasonable_clip_window(self) -> None:
        duration = validate_clip_window(12.0, 30.0)
        self.assertEqual(duration, 18.0)

    def test_rejects_negative_clip_times(self) -> None:
        with self.assertRaises(HTTPException) as context:
            validate_clip_window(-1.0, 15.0)
        self.assertEqual(context.exception.status_code, 422)
        self.assertIn("zero or greater", str(context.exception.detail))

    def test_rejects_too_short_clip(self) -> None:
        with self.assertRaises(HTTPException) as context:
            validate_clip_window(0.0, MIN_CLIP_DURATION_SECONDS - 0.5)
        self.assertEqual(context.exception.status_code, 422)
        self.assertIn("at least", str(context.exception.detail))

    def test_rejects_too_long_clip(self) -> None:
        with self.assertRaises(HTTPException) as context:
            validate_clip_window(0.0, MAX_CLIP_DURATION_SECONDS + 1.0)
        self.assertEqual(context.exception.status_code, 422)
        self.assertIn("or less", str(context.exception.detail))

    def test_rejects_clip_past_source_duration(self) -> None:
        with self.assertRaises(HTTPException) as context:
            validate_clip_window(10.0, 42.5, max_source_duration=40.0)
        self.assertEqual(context.exception.status_code, 422)
        self.assertIn("source video duration", str(context.exception.detail))
