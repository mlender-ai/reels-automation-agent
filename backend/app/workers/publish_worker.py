import random
import time
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.constants import PublishStatus
from app.core.logging import get_logger
from app.db.session import SessionLocal
from app.models.clip_candidate import ClipCandidate
from app.models.publish_job import PublishJob
from app.services.publish_service import get_publish_adapter

logger = get_logger(__name__)


def simulate_publish_job(job_id: int) -> None:
    time.sleep(1.2)
    with SessionLocal() as db:
        job = db.scalar(
            select(PublishJob)
            .where(PublishJob.id == job_id)
            .options(selectinload(PublishJob.clip_candidate).selectinload(ClipCandidate.exports))
        )
        if not job:
            logger.warning("Publish simulation skipped because job was missing. job_id=%s", job_id)
            return
        try:
            logger.info("Running mock publish job. job_id=%s clip_id=%s platform=%s", job.id, job.clip_candidate_id, job.platform)
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
                logger.info("Mock publish job completed. job_id=%s platform=%s", job.id, job.platform)
            else:
                job.status = PublishStatus.failed.value
                job.result_json = {
                    "status": PublishStatus.failed.value,
                    "posted": False,
                    "failed_at": datetime.now(timezone.utc).isoformat(),
                    "error": "Mock network issue",
                    **publish_result,
                }
                logger.warning("Mock publish job failed. job_id=%s platform=%s", job.id, job.platform)
        except Exception as exc:
            job.status = PublishStatus.failed.value
            job.result_json = {
                "status": PublishStatus.failed.value,
                "posted": False,
                "failed_at": datetime.now(timezone.utc).isoformat(),
                "error": str(exc),
            }
            logger.exception("Unexpected publish worker failure. job_id=%s platform=%s", job.id, job.platform)
        db.add(job)
        db.commit()
