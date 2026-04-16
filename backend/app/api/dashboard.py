from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.dashboard import DashboardSummaryRead
from app.services.project_service import get_dashboard_summary


router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummaryRead)
def dashboard_summary(db: Session = Depends(get_db)) -> dict:
    return get_dashboard_summary(db)

