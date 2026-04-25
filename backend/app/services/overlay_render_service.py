from __future__ import annotations

import os
import subprocess
from dataclasses import dataclass
from pathlib import Path

from app.core.logging import get_logger
from app.services.shorts_story_service import ClipStoryPackage
from app.utils.paths import project_clips_dir


logger = get_logger(__name__)
REPO_ROOT = Path(__file__).resolve().parents[3]
SWIFT_RENDER_SCRIPT = REPO_ROOT / "scripts" / "render_caption.swift"


@dataclass(frozen=True)
class OverlayCardSpec:
    text: str
    width: int
    height: int
    font_size: int
    horizontal_padding: int
    vertical_padding: int
    background_hex: str
    background_alpha: float
    foreground_hex: str = "FFFFFF"
    corner_radius: int = 24
    style: str = "micro-title"
    eyebrow: str = ""
    accent_hex: str = "FFFFFF"


@dataclass(frozen=True)
class RenderedOverlayAsset:
    path: Path
    x: str
    y: str
    start: float | None = None
    end: float | None = None


def _render_card(output_path: Path, card: OverlayCardSpec) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    env["SWIFT_MODULECACHE_PATH"] = "/tmp/swift-module-cache"
    env["CLANG_MODULE_CACHE_PATH"] = "/tmp/swift-module-cache"
    command = [
        "swift",
        str(SWIFT_RENDER_SCRIPT),
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
        card.style,
        card.eyebrow,
        card.accent_hex,
    ]
    subprocess.run(command, check=True, env=env, capture_output=True, text=True)


def build_story_overlay_assets(project_id: int, clip_id: int, base_name: str, story_package: ClipStoryPackage) -> list[RenderedOverlayAsset]:
    overlay_dir = project_clips_dir(project_id) / f"{base_name}-overlays"
    overlay_dir.mkdir(parents=True, exist_ok=True)
    rendered_assets: list[RenderedOverlayAsset] = []

    title_card = OverlayCardSpec(
        text=story_package.analysis_headline,
        width=872,
        height=124,
        font_size=40,
        horizontal_padding=34,
        vertical_padding=28,
        background_hex="000000",
        background_alpha=0.78,
        foreground_hex="FFFFFF",
        corner_radius=30,
        style="micro-title",
        eyebrow=story_package.top_label,
        accent_hex="FFFFFF",
    )
    title_path = overlay_dir / f"clip-{clip_id}-story-title.png"
    _render_card(title_path, title_card)
    rendered_assets.append(RenderedOverlayAsset(path=title_path, x="(W-w)/2", y="72", start=0.0, end=None))

    for index, cue in enumerate(story_package.caption_cues, start=1):
        font_size = 64 if len(cue.text) <= 14 else 58 if len(cue.text) <= 22 else 52 if len(cue.text) <= 30 else 46
        caption_card = OverlayCardSpec(
            text=cue.text,
            width=980,
            height=236,
            font_size=font_size,
            horizontal_padding=52,
            vertical_padding=48,
            background_hex="000000",
            background_alpha=0.0,
            foreground_hex="FFFFFF",
            corner_radius=10,
            style="kinetic-caption",
            eyebrow=story_package.story_angle,
            accent_hex="FFFFFF",
        )
        caption_path = overlay_dir / f"clip-{clip_id}-story-caption-{index}.png"
        _render_card(caption_path, caption_card)
        rendered_assets.append(
            RenderedOverlayAsset(
                path=caption_path,
                x="(W-w)/2",
                y="H-h-348",
                start=cue.start,
                end=cue.end,
            )
        )

    logger.info("Rendered story overlays. project_id=%s clip_id=%s asset_count=%s", project_id, clip_id, len(rendered_assets))
    return rendered_assets
