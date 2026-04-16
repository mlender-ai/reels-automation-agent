from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.system import SystemStatusRead
from app.services.system_service import get_system_status


router = APIRouter(prefix="/system", tags=["system"])


@router.get("/status", response_model=SystemStatusRead)
def system_status_endpoint(db: Session = Depends(get_db)) -> dict:
    return get_system_status(db)
