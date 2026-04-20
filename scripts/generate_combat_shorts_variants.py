from __future__ import annotations

import argparse
import os
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = REPO_ROOT / "backend"
sys.path.insert(0, str(BACKEND_ROOT))

from app.core.constants import ClipStatus, ExportStatus, ProjectStatus  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models.clip_candidate import ClipCandidate  # noqa: E402
from app.models.export import Export  # noqa: E402
from app.models.project import Project  # noqa: E402
from app.models.source_video import SourceVideo  # noqa: E402
from app.services.ffmpeg_service import extract_thumbnail, probe_video  # noqa: E402
from app.utils.paths import ensure_project_directories, project_exports_dir, resolve_data_path, to_relative_data_path  # noqa: E402


@dataclass(frozen=True)
class OverlayCard:
    text: str
    width: int
    height: int
    font_size: int
    horizontal_padding: int
    vertical_padding: int
    background_hex: str
    background_alpha: float
    foreground_hex: str = "FFFFFF"
    corner_radius: int = 30


@dataclass(frozen=True)
class CaptionCue:
    start: float
    end: float
    card: OverlayCard


@dataclass(frozen=True)
class VariantDefinition:
    key: str
    title: str
    hook_text: str
    description: str
    hashtags: str
    subtitle_preset: str
    score: float
    title_card: OverlayCard
    captions: list[CaptionCue]


VARIANTS: list[VariantDefinition] = [
    VariantDefinition(
        key="legend",
        title="레전드 장면은 이렇게 남는다",
        hook_text="이 장면이 진짜 레전드다",
        description="첫 동작으로 가드를 얼리고, 각도가 열리는 순간 연타로 분위기를 뒤집는 레전드형 숏츠 컷입니다.",
        hashtags="#격투기 #복싱 #숏츠 #레전드장면 #하이라이트 #fight #boxing",
        subtitle_preset="creator",
        score=98.6,
        title_card=OverlayCard(
            text="레전드 장면은 이렇게 남는다",
            width=940,
            height=190,
            font_size=58,
            horizontal_padding=50,
            vertical_padding=34,
            background_hex="0B0B0E",
            background_alpha=0.78,
            foreground_hex="FFFFFF",
            corner_radius=34,
        ),
        captions=[
            CaptionCue(
                start=0.7,
                end=4.4,
                card=OverlayCard(
                    text="잽 한 번으로 가드를 먼저 묶고",
                    width=900,
                    height=170,
                    font_size=47,
                    horizontal_padding=42,
                    vertical_padding=26,
                    background_hex="101214",
                    background_alpha=0.78,
                ),
            ),
            CaptionCue(
                start=4.45,
                end=8.6,
                card=OverlayCard(
                    text="숨긴 오른손 타이밍이 바로 들어간다",
                    width=930,
                    height=176,
                    font_size=46,
                    horizontal_padding=38,
                    vertical_padding=24,
                    background_hex="101214",
                    background_alpha=0.78,
                ),
            ),
            CaptionCue(
                start=8.65,
                end=13.25,
                card=OverlayCard(
                    text="연타가 꽂히는 순간 분위기가 뒤집힌다",
                    width=940,
                    height=178,
                    font_size=46,
                    horizontal_padding=38,
                    vertical_padding=24,
                    background_hex="101214",
                    background_alpha=0.78,
                ),
            ),
        ],
    ),
    VariantDefinition(
        key="finish",
        title="가드 열리자마자 바로 끝났다",
        hook_text="가드 열리는 순간 바로 끝났다",
        description="피니시 중심으로 호흡을 짧게 끊어, 맞는 순간과 연타 마무리를 더 빠르게 소비하게 만드는 숏츠 컷입니다.",
        hashtags="#격투기 #복싱 #피니시 #한방 #숏츠 #fightnight #knockout",
        subtitle_preset="bold",
        score=97.8,
        title_card=OverlayCard(
            text="가드 열리자마자 바로 끝났다",
            width=950,
            height=198,
            font_size=60,
            horizontal_padding=48,
            vertical_padding=34,
            background_hex="591313",
            background_alpha=0.86,
            foreground_hex="FFF8E1",
            corner_radius=34,
        ),
        captions=[
            CaptionCue(
                start=0.6,
                end=4.2,
                card=OverlayCard(
                    text="시선이 위로 뜨는 그 순간",
                    width=860,
                    height=162,
                    font_size=49,
                    horizontal_padding=40,
                    vertical_padding=22,
                    background_hex="7A1919",
                    background_alpha=0.88,
                    foreground_hex="FFF4D6",
                ),
            ),
            CaptionCue(
                start=4.25,
                end=8.0,
                card=OverlayCard(
                    text="오른손이 먼저 찍히고",
                    width=820,
                    height=162,
                    font_size=50,
                    horizontal_padding=38,
                    vertical_padding=22,
                    background_hex="7A1919",
                    background_alpha=0.88,
                    foreground_hex="FFF4D6",
                ),
            ),
            CaptionCue(
                start=8.05,
                end=12.7,
                card=OverlayCard(
                    text="마지막 연타로 완전히 마무리",
                    width=900,
                    height=170,
                    font_size=48,
                    horizontal_padding=38,
                    vertical_padding=22,
                    background_hex="7A1919",
                    background_alpha=0.88,
                    foreground_hex="FFF4D6",
                ),
            ),
        ],
    ),
    VariantDefinition(
        key="analysis",
        title="마지막 펀치보다 앞동작이 핵심",
        hook_text="진짜 핵심은 마지막 펀치가 아니다",
        description="격투기 분석형 포맷에 맞춰, 각도와 페인트 흐름을 짧게 설명하면서도 숏츠 속도를 유지하는 버전입니다.",
        hashtags="#격투기분석 #복싱분석 #숏츠 #전술 #하이라이트 #boxingbreakdown #combat",
        subtitle_preset="clean",
        score=96.9,
        title_card=OverlayCard(
            text="마지막 펀치보다 앞동작이 핵심",
            width=960,
            height=192,
            font_size=55,
            horizontal_padding=48,
            vertical_padding=32,
            background_hex="0D2B38",
            background_alpha=0.84,
            foreground_hex="E7FCFF",
            corner_radius=34,
        ),
        captions=[
            CaptionCue(
                start=0.9,
                end=4.55,
                card=OverlayCard(
                    text="포인트 1. 잽으로 시선부터 고정",
                    width=900,
                    height=170,
                    font_size=45,
                    horizontal_padding=40,
                    vertical_padding=24,
                    background_hex="123B4A",
                    background_alpha=0.86,
                    foreground_hex="E8FBFF",
                ),
            ),
            CaptionCue(
                start=4.6,
                end=8.85,
                card=OverlayCard(
                    text="포인트 2. 페인트로 수비 반응 유도",
                    width=920,
                    height=172,
                    font_size=44,
                    horizontal_padding=38,
                    vertical_padding=24,
                    background_hex="123B4A",
                    background_alpha=0.86,
                    foreground_hex="E8FBFF",
                ),
            ),
            CaptionCue(
                start=8.9,
                end=13.3,
                card=OverlayCard(
                    text="포인트 3. 열린 각도에 연타 연결",
                    width=910,
                    height=172,
                    font_size=44,
                    horizontal_padding=38,
                    vertical_padding=24,
                    background_hex="123B4A",
                    background_alpha=0.86,
                    foreground_hex="E8FBFF",
                ),
            ),
        ],
    ),
]


def run_command(command: list[str], env: dict[str, str] | None = None) -> None:
    subprocess.run(command, check=True, env=env)


def render_card(output_path: Path, card: OverlayCard) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    env["SWIFT_MODULECACHE_PATH"] = "/tmp/swift-module-cache"
    env["CLANG_MODULE_CACHE_PATH"] = "/tmp/swift-module-cache"
    command = [
        "swift",
        str(REPO_ROOT / "scripts" / "render_caption.swift"),
        str(output_path),
        card.text,
        str(card.width),
        str(card.height),
        str(card.font_size),
        str(card.horizontal_padding),
        str(card.vertical_padding),
        card.background_hex,
        str(card.background_alpha),
        card.foreground_hex,
        str(card.corner_radius),
    ]
    run_command(command, env=env)


def build_variant_video(source_path: Path, export_path: Path, variant: VariantDefinition, overlays_dir: Path) -> Path:
    export_path.parent.mkdir(parents=True, exist_ok=True)
    overlays_dir.mkdir(parents=True, exist_ok=True)

    title_path = overlays_dir / f"{variant.key}-title.png"
    caption_paths = [overlays_dir / f"{variant.key}-cap-{index + 1}.png" for index in range(len(variant.captions))]

    render_card(title_path, variant.title_card)
    for overlay_path, cue in zip(caption_paths, variant.captions, strict=True):
        render_card(overlay_path, cue.card)

    inputs = ["-i", str(source_path)]
    inputs.extend(item for overlay in [title_path, *caption_paths] for item in ("-i", str(overlay)))

    filter_parts = [
        "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[base]",
        "[base][1:v]overlay=(W-w)/2:96[v1]",
    ]
    current_label = "v1"
    bottom_y = "H-h-190"
    for index, cue in enumerate(variant.captions, start=2):
        next_label = f"v{index}"
        filter_parts.append(
            f"[{current_label}][{index}:v]overlay=(W-w)/2:{bottom_y}:enable='between(t,{cue.start:.2f},{cue.end:.2f})'[{next_label}]"
        )
        current_label = next_label

    command = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        *inputs,
        "-filter_complex",
        ";".join(filter_parts),
        "-map",
        f"[{current_label}]",
        "-map",
        "0:a?",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "20",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
        str(export_path),
    ]
    run_command(command)
    return title_path


def upsert_variant_records(project_id: int, variant: VariantDefinition, output_path: Path, thumbnail_path: Path, duration: float) -> None:
    session = SessionLocal()
    try:
        project = session.get(Project, project_id)
        if not project:
            raise RuntimeError(f"Project {project_id} was not found")

        clip = (
            session.query(ClipCandidate)
            .filter(ClipCandidate.project_id == project_id, ClipCandidate.suggested_title == variant.title)
            .one_or_none()
        )
        if clip is None:
            clip = ClipCandidate(
                project_id=project_id,
                start_time=0.0,
                end_time=round(duration, 3),
                duration=round(duration, 3),
                score=variant.score,
                hook_text=variant.hook_text,
                suggested_title=variant.title,
                suggested_description=variant.description,
                suggested_hashtags=variant.hashtags,
                subtitle_preset=variant.subtitle_preset,
                status=ClipStatus.exported.value,
            )
            session.add(clip)
            session.flush()
        else:
            clip.start_time = 0.0
            clip.end_time = round(duration, 3)
            clip.duration = round(duration, 3)
            clip.score = variant.score
            clip.hook_text = variant.hook_text
            clip.suggested_description = variant.description
            clip.suggested_hashtags = variant.hashtags
            clip.subtitle_preset = variant.subtitle_preset
            clip.status = ClipStatus.exported.value

        relative_output = to_relative_data_path(output_path)
        relative_thumbnail = to_relative_data_path(thumbnail_path)
        export_record = (
            session.query(Export)
            .filter(Export.clip_candidate_id == clip.id, Export.output_path == relative_output)
            .one_or_none()
        )
        if export_record is None:
            export_record = Export(
                clip_candidate_id=clip.id,
                output_path=relative_output,
                subtitle_path=None,
                thumbnail_path=relative_thumbnail,
                status=ExportStatus.completed.value,
            )
            session.add(export_record)
        else:
            export_record.thumbnail_path = relative_thumbnail
            export_record.status = ExportStatus.completed.value

        project.status = ProjectStatus.exported.value
        session.add(project)
        session.commit()
    finally:
        session.close()


def ensure_source(project_id: int) -> tuple[Path, float]:
    session = SessionLocal()
    try:
        source_video = (
            session.query(SourceVideo)
            .filter(SourceVideo.project_id == project_id)
            .order_by(SourceVideo.created_at.desc())
            .first()
        )
        if not source_video:
            raise RuntimeError(f"Project {project_id} does not have a source video")
        source_path = resolve_data_path(source_video.stored_path)
        metadata = probe_video(source_path)
        duration = float(metadata["duration_seconds"] or source_video.duration_seconds or 0)
        if duration <= 0:
            raise RuntimeError("Could not determine source duration")
        return source_path, duration
    finally:
        session.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate three combat sports short variants from a real local source clip.")
    parser.add_argument("--project-id", type=int, default=4, help="Project id to attach the generated variants to.")
    args = parser.parse_args()

    ensure_project_directories(args.project_id)
    source_path, duration = ensure_source(args.project_id)

    exports_dir = project_exports_dir(args.project_id)
    overlays_dir = BACKEND_ROOT / "data" / "temp" / "variant-overlays"

    print(f"Using source: {source_path}")
    for variant in VARIANTS:
        output_path = exports_dir / f"{variant.key}-combat-short.mp4"
        thumbnail_path = exports_dir / f"{variant.key}-combat-short.jpg"
        build_variant_video(source_path, output_path, variant, overlays_dir)
        extract_thumbnail(output_path, thumbnail_path, capture_time=min(1.0, max(0.25, duration / 4)))
        upsert_variant_records(args.project_id, variant, output_path, thumbnail_path, duration)
        print(f"Generated {variant.key}: {output_path}")

    print("Done. Open /exports in the local app to compare the three results.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
