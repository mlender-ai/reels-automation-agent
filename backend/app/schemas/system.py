from pydantic import BaseModel


class BinaryStatusRead(BaseModel):
    name: str
    configured: str
    available: bool
    resolved_path: str | None = None
    version: str | None = None


class StoragePathStatusRead(BaseModel):
    name: str
    path: str
    exists: bool


class SystemStatusRead(BaseModel):
    api_status: str
    database_url: str
    whisper_model_size: str
    whisper_device: str
    binaries: list[BinaryStatusRead]
    storage: list[StoragePathStatusRead]
    total_projects: int
    completed_exports: int
    queued_publish_jobs: int
