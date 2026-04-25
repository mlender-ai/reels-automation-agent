from __future__ import annotations

import sys
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.content_profile_service import CONTENT_PROFILE_COMBAT_SPORTS, CONTENT_PROFILE_SOCCER  # noqa: E402
from app.services.shorts_story_service import build_clip_story_package  # noqa: E402


class ShortsStoryServiceTests(unittest.TestCase):
    def test_builds_boxing_legend_breakdown_package(self) -> None:
        package = build_clip_story_package(
            hook_text="마이크 타이슨이 왜 레전드인지 이 장면 하나로 설명된다",
            suggested_title="마이크 타이슨이 왜 전설인지 보이는 장면",
            suggested_description="잽으로 시선을 묶고 피벗으로 각도를 연 뒤 훅과 연타로 마무리하는 복싱 전성기 움직임이다.",
            suggested_hashtags="#복싱 #타이슨 #숏츠",
            duration=17.4,
            score=92.1,
            start_time=30.0,
            end_time=47.4,
            content_profile=CONTENT_PROFILE_COMBAT_SPORTS,
            transcript_segments=[
                {"start": 0.6, "end": 3.2, "text": "잽으로 먼저 가드를 묶는다"},
                {"start": 4.0, "end": 7.0, "text": "피벗으로 각도를 바꾸고 훅이 열린다"},
                {"start": 8.1, "end": 12.0, "text": "연타가 들어가면서 완전히 흐름을 가져온다"},
            ],
        )

        self.assertIn("타이슨", package.analysis_headline)
        self.assertEqual(package.top_label, "마이크 타이슨 브레이크다운")
        self.assertEqual(len(package.analysis_outline), 3)
        self.assertTrue(any("잽" in line or "콤보" in line or "각도" in line for line in package.analysis_outline))
        self.assertEqual(len(package.caption_cues), 3)

    def test_builds_generic_soccer_breakdown_package(self) -> None:
        package = build_clip_story_package(
            hook_text="이 장면이 경기 흐름을 바꿨다",
            suggested_title="추가시간에 흐름을 뒤집은 패턴",
            suggested_description="압박에서 전환으로 이어지는 움직임과 마지막 패스 선택이 경기 결과를 갈랐다.",
            suggested_hashtags="#축구 #전술 #숏츠",
            duration=22.0,
            score=84.2,
            start_time=120.0,
            end_time=142.0,
            content_profile=CONTENT_PROFILE_SOCCER,
            transcript_segments=[
                {"start": 0.8, "end": 4.0, "text": "라인 간격을 먼저 벌린다"},
                {"start": 7.0, "end": 11.0, "text": "전환 순간 패턴이 한 번에 나온다"},
                {"start": 13.0, "end": 17.0, "text": "마지막 선택이 결과를 만든다"},
            ],
        )

        self.assertIn("흐름", package.analysis_headline)
        self.assertEqual(package.story_angle, "경기 흐름 분석")
        self.assertEqual(len(package.analysis_outline), 3)
        self.assertEqual(len(package.caption_cues), 3)


if __name__ == "__main__":
    unittest.main()
