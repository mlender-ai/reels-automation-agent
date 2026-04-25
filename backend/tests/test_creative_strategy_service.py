from __future__ import annotations

import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.content_profile_service import CONTENT_PROFILE_COMBAT_SPORTS, CONTENT_PROFILE_SOCCER  # noqa: E402
from app.services.creative_strategy_service import build_project_creative_strategy  # noqa: E402


def make_clip(
    clip_id: int,
    *,
    score: float,
    title: str,
    description: str,
    hashtags: str,
    hook: str,
    duration: float,
    start_time: float,
    profile: str,
):
    return SimpleNamespace(
        id=clip_id,
        project_id=99,
        score=score,
        suggested_title=title,
        suggested_description=description,
        suggested_hashtags=hashtags,
        hook_text=hook,
        duration=duration,
        start_time=start_time,
        end_time=start_time + duration,
        content_profile=profile,
        virality_label="강력 추천" if score >= 88 else "우선 검토",
    )


class CreativeStrategyServiceTests(unittest.TestCase):
    def test_builds_variant_cards_and_script_ideas(self) -> None:
        project = SimpleNamespace(id=99, title="타이슨 프로젝트")
        clips = [
            make_clip(
                1,
                score=92.4,
                title="타이슨이 왜 레전드인지 보이는 장면",
                description="잽으로 시선을 묶고 피벗으로 각도를 연 뒤 훅과 연타로 마무리한다.",
                hashtags="#복싱 #타이슨 #숏츠",
                hook="잽 하나에 분위기가 넘어간다",
                duration=13.2,
                start_time=32.0,
                profile=CONTENT_PROFILE_COMBAT_SPORTS,
            ),
            make_clip(
                2,
                score=87.1,
                title="각도 하나로 흐름 먹는 장면",
                description="페인트와 피벗으로 반응을 먼저 뺀 뒤 훅을 꽂는다.",
                hashtags="#복싱 #피벗 #콤보",
                hook="각도 열리는 순간 다 끝난다",
                duration=14.7,
                start_time=88.0,
                profile=CONTENT_PROFILE_COMBAT_SPORTS,
            ),
            make_clip(
                3,
                score=84.6,
                title="콤보 각이 열린 이유",
                description="시선을 묶고 중심이 뜨는 순간 콤보가 바로 이어진다.",
                hashtags="#복싱 #콤보 #분석",
                hook="이 장면이 자꾸 도는 이유",
                duration=16.3,
                start_time=121.0,
                profile=CONTENT_PROFILE_COMBAT_SPORTS,
            ),
        ]

        strategy = build_project_creative_strategy(project, clips)

        self.assertEqual(strategy.project_id, 99)
        self.assertEqual(len(strategy.format_variants), 4)
        self.assertGreaterEqual(len(strategy.script_ideas), 4)
        self.assertIn("격투기", strategy.strategy_focus)
        self.assertTrue(any("타이틀" in variant.visual_direction or "제목" in variant.visual_direction for variant in strategy.format_variants))
        self.assertTrue(any("이유" in idea.title or "왜" in idea.hook for idea in strategy.script_ideas))

    def test_builds_soccer_specific_focus_copy(self) -> None:
        project = SimpleNamespace(id=77, title="축구 프로젝트")
        clips = [
            make_clip(
                10,
                score=89.0,
                title="추가시간에 흐름 뒤집는 장면",
                description="전환 타이밍과 마지막 패스 선택이 결과를 바꾼다.",
                hashtags="#축구 #역전 #숏츠",
                hook="이 장면에서 경기 흐름이 바뀐다",
                duration=19.0,
                start_time=520.0,
                profile=CONTENT_PROFILE_SOCCER,
            )
        ]

        strategy = build_project_creative_strategy(project, clips)

        self.assertIn("축구", strategy.strategy_focus)
        self.assertEqual(strategy.format_variants[0].source_clip_id, 10)
        self.assertTrue(strategy.script_ideas)


if __name__ == "__main__":
    unittest.main()
