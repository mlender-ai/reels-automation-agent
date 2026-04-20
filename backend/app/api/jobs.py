from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.workflow_job import WorkflowJobRead
from app.services.serializers import serialize_workflow_job
from app.services.workflow_job_service import get_workflow_job_or_404


router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/{job_id}", response_model=WorkflowJobRead)
def get_workflow_job_endpoint(job_id: int, db: Session = Depends(get_db)) -> dict:
    return serialize_workflow_job(get_workflow_job_or_404(db, job_id))
