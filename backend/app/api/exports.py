from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models.clip_candidate import ClipCandidate
from app.models.export import Export
from app.schemas.export import ExportRead
from app.services.serializers import serialize_export


router = APIRouter(tags=["exports"])


@router.get("/exports", response_model=list[ExportRead])
def list_exports_endpoint(db: Session = Depends(get_db)) -> list[dict]:
    exports = (
        db.scalars(
            select(Export)
            .options(selectinload(Export.clip_candidate).selectinload(ClipCandidate.project))
            .order_by(Export.created_at.desc())
        )
        .unique()
        .all()
    )
    return [serialize_export(export_record) for export_record in exports]


@router.get("/exports/{export_id}", response_model=ExportRead)
def get_export_endpoint(export_id: int, db: Session = Depends(get_db)) -> dict:
    export_record = db.scalar(
        select(Export)
        .where(Export.id == export_id)
        .options(selectinload(Export.clip_candidate).selectinload(ClipCandidate.project))
    )
    if not export_record:
        raise HTTPException(status_code=404, detail="Export not found")
    return serialize_export(export_record)

