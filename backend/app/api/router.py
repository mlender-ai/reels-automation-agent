from fastapi import APIRouter

from app.api.clips import router as clips_router
from app.api.dashboard import router as dashboard_router
from app.api.exports import router as exports_router
from app.api.health import router as health_router
from app.api.jobs import router as jobs_router
from app.api.projects import router as projects_router
from app.api.publish import router as publish_router
from app.api.system import router as system_router


api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(system_router)
api_router.include_router(dashboard_router)
api_router.include_router(jobs_router)
api_router.include_router(projects_router)
api_router.include_router(clips_router)
api_router.include_router(exports_router)
api_router.include_router(publish_router)
