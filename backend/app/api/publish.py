from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models.publish_job import PublishJob
from app.schemas.publish import PublishQueueResponse
from app.services.publish_service import list_platform_statuses
from app.services.serializers import serialize_publish_job


router = APIRouter(tags=["publish"])


@router.get("/publish-jobs", response_model=PublishQueueResponse)
def list_publish_jobs_endpoint(db: Session = Depends(get_db)) -> dict:
    jobs = (
        db.scalars(
            select(PublishJob)
            .options(selectinload(PublishJob.clip_candidate))
            .order_by(PublishJob.created_at.desc())
        )
        .unique()
        .all()
    )
    return {
        "items": [serialize_publish_job(job) for job in jobs],
        "platforms": list_platform_statuses(),
    }

