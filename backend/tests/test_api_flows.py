from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import settings  # noqa: E402
from app.core.constants import ClipStatus, ExportStatus, PublishStatus, WorkflowJobStatus, WorkflowJobType  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.utils.paths import ensure_app_directories, resolve_data_path  # noqa: E402


class DummyWhisperModel:
    def transcribe(self, *_args, **_kwargs):
        segments = [
            SimpleNamespace(start=0.0, end=4.8, text="Three mistakes kill retention in the first minute."),
            SimpleNamespace(start=4.9, end=10.2, text="The first is hiding the core promise until it is too late."),
            SimpleNamespace(start=10.5, end=16.7, text="If you reveal the result early, viewers instantly know why they should stay."),
            SimpleNamespace(start=16.9, end=23.4, text="The second mistake is weak framing, because the scene starts in the middle of a thought."),
            SimpleNamespace(start=23.6, end=31.2, text="The surprising part is that one comparison shot often doubles clarity and watch time."),
            SimpleNamespace(start=31.5, end=39.5, text="The third mistake is cutting before the payoff, so the ending feels unfinished."),
            SimpleNamespace(start=39.8, end=45.0, text="If you fix these three moments, the short becomes much easier to approve."),
        ]
        return iter(segments), SimpleNamespace(language="en")


class ApiFlowTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.temp_root = Path(self.temp_dir.name)
        self.original_settings = {
            "data_dir": settings.data_dir,
            "input_dir": settings.input_dir,
            "projects_dir": settings.projects_dir,
            "exports_dir": settings.exports_dir,
            "temp_dir": settings.temp_dir,
            "whisper_download_root": settings.whisper_download_root,
        }

        settings.data_dir = self.temp_root / "data"
        settings.input_dir = settings.data_dir / "input"
        settings.projects_dir = settings.data_dir / "projects"
        settings.exports_dir = settings.data_dir / "exports"
        settings.temp_dir = settings.data_dir / "temp"
        settings.whisper_download_root = settings.data_dir / "models"
        ensure_app_directories()

        self.engine = create_engine(
            f"sqlite:///{(self.temp_root / 'test.db').as_posix()}",
            connect_args={"check_same_thread": False},
        )
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)

        def override_get_db():
            db = self.SessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        self.create_db_patch = patch("app.main.create_db_and_tables", return_value=None)
        self.create_db_patch.start()
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.client.close()
        app.dependency_overrides.clear()
        self.create_db_patch.stop()
        self.engine.dispose()
        for name, value in self.original_settings.items():
            setattr(settings, name, value)
        self.temp_dir.cleanup()

    def _create_project(self, title: str = "Integration Demo") -> dict:
        response = self.client.post("/projects", json={"title": title, "source_type": "upload"})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def _upload_source(self, project_id: int, *, filename: str = "episode.mp4", content_type: str = "video/mp4") -> dict:
        with patch(
            "app.services.project_service.probe_video",
            return_value={"duration_seconds": 120.0, "width": 1920, "height": 1080, "fps": 30.0},
        ):
            response = self.client.post(
                f"/projects/{project_id}/upload",
                files={"file": (filename, b"fake video bytes", content_type)},
            )
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def _transcribe_project(self, project_id: int) -> dict:
        with patch("app.services.transcription_service._get_whisper_model", return_value=DummyWhisperModel()):
            response = self.client.post(f"/projects/{project_id}/transcribe")
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def _generate_clips(self, project_id: int) -> list[dict]:
        response = self.client.post(f"/projects/{project_id}/generate-clips")
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    @staticmethod
    def _fake_export_vertical_clip(*args, **kwargs) -> None:
        output_path = kwargs.get("output_path", args[1] if len(args) > 1 else None)
        assert output_path is not None
        Path(output_path).write_bytes(b"fake mp4 payload")

    @staticmethod
    def _fake_extract_thumbnail(*args, **kwargs) -> None:
        thumbnail_path = kwargs.get("thumbnail_path", args[1] if len(args) > 1 else None)
        assert thumbnail_path is not None
        Path(thumbnail_path).write_bytes(b"fake thumbnail")

    def _prepare_project_with_generated_clips(self) -> tuple[dict, list[dict]]:
        project = self._create_project()
        upload = self._upload_source(project["id"])
        source_path = resolve_data_path(upload["source_video"]["stored_path"])
        self.assertTrue(source_path.exists())
        transcript = self._transcribe_project(project["id"])
        transcript_path = resolve_data_path(transcript["raw_json_path"])
        self.assertTrue(transcript_path.exists())
        clips = self._generate_clips(project["id"])
        self.assertGreaterEqual(len(clips), 3)
        return project, clips

    def test_full_api_workflow_from_upload_to_publish_queue(self) -> None:
        project, clips = self._prepare_project_with_generated_clips()
        clip_id = clips[0]["id"]

        approve_response = self.client.post(f"/clips/{clip_id}/approve")
        self.assertEqual(approve_response.status_code, 200, approve_response.text)
        self.assertEqual(approve_response.json()["status"], ClipStatus.approved.value)

        with patch(
            "app.services.export_service.export_vertical_clip",
            side_effect=self._fake_export_vertical_clip,
        ), patch(
            "app.services.export_service.extract_thumbnail",
            side_effect=self._fake_extract_thumbnail,
        ):
            export_response = self.client.post(f"/clips/{clip_id}/export")

        self.assertEqual(export_response.status_code, 200, export_response.text)
        export_payload = export_response.json()
        self.assertEqual(export_payload["status"], ExportStatus.completed.value)
        self.assertTrue(resolve_data_path(export_payload["output_path"]).exists())
        self.assertTrue(resolve_data_path(export_payload["subtitle_path"]).exists())
        self.assertTrue(resolve_data_path(export_payload["thumbnail_path"]).exists())

        with patch("app.api.clips.simulate_publish_job", side_effect=lambda _job_id: None):
            publish_response = self.client.post(f"/clips/{clip_id}/queue-publish", json={"platform": "youtube"})

        self.assertEqual(publish_response.status_code, 200, publish_response.text)
        publish_payload = publish_response.json()
        self.assertEqual(publish_payload["status"], PublishStatus.queued.value)
        self.assertEqual(publish_payload["platform"], "youtube")

        exports_response = self.client.get("/exports")
        self.assertEqual(exports_response.status_code, 200, exports_response.text)
        self.assertEqual(len(exports_response.json()), 1)

        publish_jobs_response = self.client.get("/publish-jobs")
        self.assertEqual(publish_jobs_response.status_code, 200, publish_jobs_response.text)
        self.assertEqual(len(publish_jobs_response.json()["items"]), 1)
        self.assertEqual(publish_jobs_response.json()["items"][0]["status"], PublishStatus.queued.value)

        project_response = self.client.get(f"/projects/{project['id']}")
        self.assertEqual(project_response.status_code, 200, project_response.text)
        self.assertEqual(project_response.json()["export_count"], 1)

    def test_upload_endpoint_rejects_invalid_content_type(self) -> None:
        project = self._create_project()
        response = self.client.post(
            f"/projects/{project['id']}/upload",
            files={"file": ("episode.mp4", b"not really video", "text/plain")},
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Unsupported upload content type", response.json()["detail"])

    def test_generate_clips_requires_transcript(self) -> None:
        project = self._create_project()
        self._upload_source(project["id"])
        response = self.client.post(f"/projects/{project['id']}/generate-clips")
        self.assertEqual(response.status_code, 400)
        self.assertIn("Generate a transcript", response.json()["detail"])

    def test_export_requires_approved_clip(self) -> None:
        _project, clips = self._prepare_project_with_generated_clips()
        response = self.client.post(f"/clips/{clips[0]['id']}/export")
        self.assertEqual(response.status_code, 400)
        self.assertIn("approved", response.json()["detail"])

    def test_queue_publish_requires_completed_export(self) -> None:
        _project, clips = self._prepare_project_with_generated_clips()
        approve_response = self.client.post(f"/clips/{clips[0]['id']}/approve")
        self.assertEqual(approve_response.status_code, 200, approve_response.text)

        response = self.client.post(f"/clips/{clips[0]['id']}/queue-publish", json={"platform": "youtube"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("Export the clip", response.json()["detail"])

    def test_project_job_endpoints_queue_and_list_background_runs(self) -> None:
        project = self._create_project()
        self._upload_source(project["id"])

        with patch("app.api.projects.run_transcription_job", side_effect=lambda _job_id: None):
            transcribe_job_response = self.client.post(f"/projects/{project['id']}/transcribe/start")

        self.assertEqual(transcribe_job_response.status_code, 202, transcribe_job_response.text)
        transcribe_job = transcribe_job_response.json()
        self.assertEqual(transcribe_job["job_type"], WorkflowJobType.transcribe.value)
        self.assertEqual(transcribe_job["status"], WorkflowJobStatus.queued.value)

        jobs_response = self.client.get(f"/projects/{project['id']}/jobs")
        self.assertEqual(jobs_response.status_code, 200, jobs_response.text)
        jobs_payload = jobs_response.json()
        self.assertEqual(len(jobs_payload), 1)
        self.assertEqual(jobs_payload[0]["id"], transcribe_job["id"])

        job_detail_response = self.client.get(f"/jobs/{transcribe_job['id']}")
        self.assertEqual(job_detail_response.status_code, 200, job_detail_response.text)
        self.assertEqual(job_detail_response.json()["project_id"], project["id"])

        self._transcribe_project(project["id"])
        with patch("app.api.projects.run_clip_generation_job", side_effect=lambda _job_id: None):
            clip_job_response = self.client.post(f"/projects/{project['id']}/generate-clips/start")

        self.assertEqual(clip_job_response.status_code, 202, clip_job_response.text)
        clip_job = clip_job_response.json()
        self.assertEqual(clip_job["job_type"], WorkflowJobType.generate_clips.value)
        self.assertEqual(clip_job["status"], WorkflowJobStatus.queued.value)

    def test_clip_job_endpoints_queue_export_and_publish_runs(self) -> None:
        _project, clips = self._prepare_project_with_generated_clips()
        clip_id = clips[0]["id"]

        approve_response = self.client.post(f"/clips/{clip_id}/approve")
        self.assertEqual(approve_response.status_code, 200, approve_response.text)

        with patch("app.api.clips.run_export_job", side_effect=lambda _job_id: None):
            export_job_response = self.client.post(f"/clips/{clip_id}/export/start")

        self.assertEqual(export_job_response.status_code, 202, export_job_response.text)
        export_job = export_job_response.json()
        self.assertEqual(export_job["job_type"], WorkflowJobType.export.value)
        self.assertEqual(export_job["status"], WorkflowJobStatus.queued.value)

        clip_jobs_response = self.client.get(f"/clips/{clip_id}/jobs")
        self.assertEqual(clip_jobs_response.status_code, 200, clip_jobs_response.text)
        clip_jobs = clip_jobs_response.json()
        self.assertEqual(len(clip_jobs), 1)
        self.assertEqual(clip_jobs[0]["clip_candidate_id"], clip_id)

        with patch(
            "app.services.export_service.export_vertical_clip",
            side_effect=self._fake_export_vertical_clip,
        ), patch(
            "app.services.export_service.extract_thumbnail",
            side_effect=self._fake_extract_thumbnail,
        ):
            self.client.post(f"/clips/{clip_id}/export")

        with patch("app.api.clips.run_publish_job", side_effect=lambda _job_id: None):
            publish_job_response = self.client.post(f"/clips/{clip_id}/queue-publish/start", json={"platform": "youtube"})

        self.assertEqual(publish_job_response.status_code, 202, publish_job_response.text)
        publish_job = publish_job_response.json()
        self.assertEqual(publish_job["job_type"], WorkflowJobType.publish.value)
        self.assertEqual(publish_job["status"], WorkflowJobStatus.queued.value)
