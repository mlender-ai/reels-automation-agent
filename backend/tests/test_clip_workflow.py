from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from fastapi import HTTPException

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.constants import ClipStatus, ExportStatus, PublishStatus  # noqa: E402
from app.services.clip_workflow_service import transition_clip_status  # noqa: E402
from app.services.publish_service import _validate_publishable_clip  # noqa: E402


class ClipWorkflowTests(unittest.TestCase):
    def test_approve_is_idempotent_for_exported_clip(self) -> None:
        clip = SimpleNamespace(status=ClipStatus.exported.value)
        updated = transition_clip_status(clip, ClipStatus.approved)
        self.assertEqual(updated.status, ClipStatus.exported.value)

    def test_reject_blocks_exported_clip(self) -> None:
        clip = SimpleNamespace(status=ClipStatus.exported.value)
        with self.assertRaises(HTTPException) as context:
            transition_clip_status(clip, ClipStatus.rejected)
        self.assertEqual(context.exception.status_code, 409)
        self.assertIn("cannot be rejected", str(context.exception.detail))


class PublishValidationTests(unittest.TestCase):
    def make_clip(self, *, status: str, export_status: str, publish_jobs: list | None = None, output_path: str = "projects/demo/exports/file.mp4"):
        export_record = SimpleNamespace(status=export_status, output_path=output_path, thumbnail_path=None, subtitle_path=None)
        return SimpleNamespace(
            id=1,
            project_id=1,
            status=status,
            suggested_title="Title",
            suggested_description="Description",
            suggested_hashtags="#shorts #demo",
            exports=[export_record],
            publish_jobs=publish_jobs or [],
        )

    def test_publish_requires_approved_or_exported_clip(self) -> None:
        clip = self.make_clip(status=ClipStatus.pending.value, export_status=ExportStatus.completed.value)
        with self.assertRaises(HTTPException) as context:
            _validate_publishable_clip(clip, "youtube")
        self.assertEqual(context.exception.status_code, 400)

    def test_publish_blocks_duplicate_queued_job(self) -> None:
        with tempfile.NamedTemporaryFile() as handle:
            output_path = Path(handle.name)
            clip = self.make_clip(
                status=ClipStatus.exported.value,
                export_status=ExportStatus.completed.value,
                publish_jobs=[SimpleNamespace(platform="youtube", status=PublishStatus.queued.value)],
                output_path=str(output_path),
            )
            with self.assertRaises(HTTPException) as context:
                _validate_publishable_clip(clip, "youtube")
            self.assertEqual(context.exception.status_code, 409)
            self.assertIn("already queued", str(context.exception.detail))
