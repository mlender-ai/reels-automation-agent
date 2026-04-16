import random
import time
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.constants import PublishStatus
from app.db.session import SessionLocal
from app.models.clip_candidate import ClipCandidate
from app.models.publish_job import PublishJob
from app.services.publish_service import get_publish_adapter


def simulate_publish_job(job_id: int) -> None:
    time.sleep(1.2)
    with SessionLocal() as db:
        job = db.scalar(
            select(PublishJob)
            .where(PublishJob.id == job_id)
            .options(selectinload(PublishJob.clip_candidate).selectinload(ClipCandidate.exports))
        )
        if not job:
            return
        adapter = get_publish_adapter(job.platform)
        publish_result = adapter.publish(job.payload_json or {})
        if random.random() < 0.88:
            job.status = PublishStatus.posted.value
            job.result_json = {
                "status": PublishStatus.posted.value,
                "posted": True,
                "posted_at": datetime.now(timezone.utc).isoformat(),
                **publish_result,
            }
        else:
            job.status = PublishStatus.failed.value
            job.result_json = {
                "status": PublishStatus.failed.value,
                "posted": False,
                "failed_at": datetime.now(timezone.utc).isoformat(),
                "error": "Mock network issue",
                **publish_result,
            }
        db.add(job)
        db.commit()
