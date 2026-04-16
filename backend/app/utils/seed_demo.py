# ruff: noqa: E402

import argparse
import json
import shutil
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.append(str(BACKEND_DIR))

from app.core.constants import ProjectStatus
from app.db.session import SessionLocal, create_db_and_tables
from app.models.project import Project
from app.models.source_video import SourceVideo
from app.models.transcript import Transcript
from app.services.clip_scoring_service import generate_clip_candidates
from app.services.ffmpeg_service import probe_video
from app.utils.files import safe_filename
from app.utils.paths import ensure_app_directories, project_source_dir, project_transcripts_dir, to_relative_data_path

SEED_TRANSCRIPT_PATH = BACKEND_DIR / "data" / "seed" / "demo_transcript.json"


def seed_demo_project(title: str, video_path: Path | None = None) -> int:
    ensure_app_directories()
    create_db_and_tables()
    transcript_payload = json.loads(SEED_TRANSCRIPT_PATH.read_text(encoding="utf-8"))

    with SessionLocal() as db:
        project = Project(title=title, source_type="upload", status=ProjectStatus.transcribed.value)
        db.add(project)
        db.commit()
        db.refresh(project)

        if video_path:
            source_dir = project_source_dir(project.id)
            source_dir.mkdir(parents=True, exist_ok=True)
            target = source_dir / safe_filename(video_path.name)
            shutil.copy2(video_path, target)
            metadata = probe_video(target)
            relative_video_path = to_relative_data_path(target)
            project.source_path = relative_video_path
            db.add(
                SourceVideo(
                    project_id=project.id,
                    original_filename=video_path.name,
                    stored_path=relative_video_path,
                    duration_seconds=metadata["duration_seconds"],
                    width=metadata["width"],
                    height=metadata["height"],
                    fps=metadata["fps"],
                )
            )

        transcript_payload["project_id"] = project.id
        transcripts_dir = project_transcripts_dir(project.id)
        transcripts_dir.mkdir(parents=True, exist_ok=True)
        transcript_path = transcripts_dir / "transcript_latest.json"
        transcript_path.write_text(json.dumps(transcript_payload, ensure_ascii=False, indent=2), encoding="utf-8")

        transcript = Transcript(
            project_id=project.id,
            language=transcript_payload.get("language"),
            model_name="seed-demo",
            raw_json_path=to_relative_data_path(transcript_path),
            text=" ".join(segment["text"] for segment in transcript_payload.get("segments", [])),
        )
        db.add(transcript)
        db.commit()
        db.refresh(transcript)

        generate_clip_candidates(db, project, transcript)
        return project.id


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed a demo project with transcript and heuristic clip candidates.")
    parser.add_argument("--title", default="Seed Demo Project", help="Project title for the seeded data")
    parser.add_argument("--video", type=Path, default=None, help="Optional path to a local video file to attach")
    args = parser.parse_args()

    project_id = seed_demo_project(args.title, args.video)
    print(f"Seeded demo project #{project_id}")


if __name__ == "__main__":
    main()
