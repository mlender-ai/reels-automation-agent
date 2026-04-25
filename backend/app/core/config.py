from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BACKEND_DIR / "data"


class Settings(BaseSettings):
    app_name: str = "Reels Automation Agent API"
    log_level: str = "INFO"
    database_url: str = f"sqlite:///{(DATA_DIR / 'app.db').as_posix()}"
    frontend_origin: str = "http://localhost:5173"
    data_dir: Path = DATA_DIR
    input_dir: Path = DATA_DIR / "input"
    projects_dir: Path = DATA_DIR / "projects"
    exports_dir: Path = DATA_DIR / "exports"
    temp_dir: Path = DATA_DIR / "temp"
    whisper_download_root: Path = DATA_DIR / "models"
    whisper_model_size: str = "base"
    whisper_device: str = "cpu"
    whisper_compute_type: str = "int8"
    ffmpeg_binary: str = "ffmpeg"
    ffprobe_binary: str = "ffprobe"
    ytdlp_vendor_path: Path = BACKEND_DIR / ".vendor"
    ytdlp_enabled: bool = True

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_prefix="RAA_",
        extra="ignore",
    )

    @field_validator("data_dir", "input_dir", "projects_dir", "exports_dir", "temp_dir", "whisper_download_root", mode="before")
    @classmethod
    def _ensure_path(cls, value: str | Path) -> Path:
        return Path(value)

    @property
    def cors_origins(self) -> list[str]:
        base = [origin.strip() for origin in self.frontend_origin.split(",") if origin.strip()]
        return base or ["http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
