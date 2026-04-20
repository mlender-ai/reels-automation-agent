from fastapi import HTTPException

from app.core.constants import ClipStatus
from app.models.clip_candidate import ClipCandidate


def transition_clip_status(clip: ClipCandidate, target_status: ClipStatus) -> ClipCandidate:
    current_status = clip.status

    if target_status == ClipStatus.approved:
        if current_status == ClipStatus.exported.value:
            return clip
        if current_status in {ClipStatus.pending.value, ClipStatus.rejected.value, ClipStatus.approved.value}:
            clip.status = ClipStatus.approved.value
            return clip

    if target_status == ClipStatus.rejected:
        if current_status == ClipStatus.exported.value:
            raise HTTPException(
                status_code=409,
                detail="Exported clips cannot be rejected directly. Edit the clip and create a new export if the content needs changes.",
            )
        if current_status in {ClipStatus.pending.value, ClipStatus.approved.value, ClipStatus.rejected.value}:
            clip.status = ClipStatus.rejected.value
            return clip

    raise HTTPException(status_code=409, detail=f"Clip cannot transition from {current_status} to {target_status.value}")
