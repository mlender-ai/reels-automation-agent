import random
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.constants import PublishStatus
from app.models.clip_candidate import ClipCandidate
from app.models.publish_job import PublishJob


class PublishAdapter(ABC):
    adapter_name: str
    platform: str

    def connect(self) -> dict[str, Any]:
        return {"status": PublishStatus.ready.value, "account_label": "Local mock account", "connected": True}

    def validate_account(self) -> dict[str, Any]:
        return {"status": PublishStatus.ready.value, "account_label": "Local mock account", "connected": True}

    @abstractmethod
    def publish(self, payload: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError

    def get_status(self, job_id: int) -> dict[str, Any]:
        return {"job_id": job_id, "status": PublishStatus.queued.value}


class MockYouTubeAdapter(PublishAdapter):
    adapter_name = "mock_youtube_adapter"
    platform = "youtube"

    def publish(self, payload: dict[str, Any]) -> dict[str, Any]:
        return {"remote_id": f"yt-{random.randint(1000, 9999)}", "payload": payload}


class MockInstagramAdapter(PublishAdapter):
    adapter_name = "mock_instagram_adapter"
    platform = "instagram"

    def publish(self, payload: dict[str, Any]) -> dict[str, Any]:
        return {"remote_id": f"ig-{random.randint(1000, 9999)}", "payload": payload}


class MockTikTokAdapter(PublishAdapter):
    adapter_name = "mock_tiktok_adapter"
    platform = "tiktok"

    def publish(self, payload: dict[str, Any]) -> dict[str, Any]:
        return {"remote_id": f"tt-{random.randint(1000, 9999)}", "payload": payload}


ADAPTERS: dict[str, PublishAdapter] = {
    "youtube": MockYouTubeAdapter(),
    "instagram": MockInstagramAdapter(),
    "tiktok": MockTikTokAdapter(),
}


def get_publish_adapter(platform: str) -> PublishAdapter:
    try:
        return ADAPTERS[platform]
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=f"Unsupported platform: {platform}") from exc


def create_publish_job(db: Session, clip: ClipCandidate, platform: str) -> PublishJob:
    adapter = get_publish_adapter(platform)
    latest_export = clip.exports[0] if getattr(clip, "exports", None) else None
    if not latest_export or latest_export.status != "completed":
        raise HTTPException(status_code=400, detail="Export the clip before adding it to the publish queue")
    validation = adapter.validate_account()
    payload = {
        "clip": {
            "id": clip.id,
            "project_id": clip.project_id,
            "title": clip.suggested_title,
            "description": clip.suggested_description,
            "hashtags": clip.suggested_hashtags,
        },
        "media": {
            "export_path": latest_export.output_path,
            "thumbnail_path": latest_export.thumbnail_path,
            "subtitle_path": latest_export.subtitle_path,
        },
        "platform": platform,
        "adapter": adapter.adapter_name,
        "requested_at": datetime.now(timezone.utc).isoformat(),
    }
    publish_job = PublishJob(
        clip_candidate_id=clip.id,
        platform=platform,
        adapter_name=adapter.adapter_name,
        status=PublishStatus.queued.value,
        payload_json=payload,
        result_json={
            "status": PublishStatus.queued.value,
            "queued": True,
            "account_label": validation["account_label"],
            "connected": validation["connected"],
        },
    )
    db.add(publish_job)
    db.commit()
    db.refresh(publish_job)
    return publish_job


def list_platform_statuses() -> list[dict[str, str]]:
    return [
        {
            "platform": adapter.platform,
            "adapter_name": adapter.adapter_name,
            "status": adapter.validate_account()["status"],
            "account_label": adapter.validate_account()["account_label"],
        }
        for adapter in ADAPTERS.values()
    ]


def list_publish_jobs(db: Session) -> list[PublishJob]:
    return db.scalars(select(PublishJob).order_by(PublishJob.created_at.desc())).all()
