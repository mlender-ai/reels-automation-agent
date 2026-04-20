from __future__ import annotations

import re

CONTENT_PROFILE_GENERAL = "general"
CONTENT_PROFILE_COMBAT_SPORTS = "combat_sports"

COMBAT_SPORTS_KEYWORDS = {
    "mma",
    "ufc",
    "fight",
    "fighter",
    "fighters",
    "boxing",
    "boxer",
    "muay",
    "thai",
    "kickboxing",
    "kickboxer",
    "wrestling",
    "wrestler",
    "jiujitsu",
    "jiu",
    "bjj",
    "grappling",
    "submission",
    "armbar",
    "triangle",
    "rear",
    "naked",
    "choke",
    "takedown",
    "sprawl",
    "jab",
    "cross",
    "hook",
    "uppercut",
    "counter",
    "feint",
    "headkick",
    "bodyshot",
    "knockout",
    "ko",
    "finish",
    "stoppage",
    "referee",
    "round",
    "corner",
    "champion",
    "belt",
    "title",
    "weigh",
    "staredown",
    "scorecards",
    "octagon",
    "cage",
    "gloves",
    "sparring",
    "gym",
    "southpaw",
    "orthodox",
    "파이터",
    "격투기",
    "복싱",
    "킥복싱",
    "무에타이",
    "레슬링",
    "주짓수",
    "그라운드",
    "서브미션",
    "암바",
    "초크",
    "테이크다운",
    "카운터",
    "펀치",
    "킥",
    "헤드킥",
    "바디샷",
    "라운드",
    "판정",
    "챔피언",
    "타이틀",
    "케이지",
    "옥타곤",
    "세컨",
}

COMBAT_SPORTS_FINISH_TERMS = {
    "knockout",
    "ko",
    "finish",
    "stoppage",
    "drop",
    "dropped",
    "rocked",
    "wobbled",
    "caught",
    "counter",
    "countered",
    "submitted",
    "submission",
    "tap",
    "tapped",
    "choke",
    "armbar",
    "triangle",
    "headkick",
    "bodyshot",
    "slept",
    "stunned",
    "피니시",
    "다운",
    "실신",
    "초크",
    "서브미션",
    "암바",
}

COMBAT_SPORTS_ANALYSIS_TERMS = {
    "why",
    "how",
    "mistake",
    "setup",
    "sequence",
    "timing",
    "distance",
    "angle",
    "defense",
    "offense",
    "guard",
    "feint",
    "coach",
    "corner",
    "decision",
    "scorecards",
    "controversy",
    "왜",
    "어떻게",
    "실수",
    "세팅",
    "타이밍",
    "거리",
    "각도",
    "방어",
    "공격",
    "가드",
    "코치",
    "판정",
    "논란",
    "결정적",
}


def tokenize_text(text: str) -> list[str]:
    return re.findall(r"[0-9A-Za-z가-힣]{2,}", text.lower())


def combat_sports_signal_score(text: str) -> int:
    tokens = tokenize_text(text)
    if not tokens:
        return 0
    token_hits = sum(1 for token in tokens if token in COMBAT_SPORTS_KEYWORDS)
    phrase_text = " ".join(tokens)
    phrase_hits = 0
    for phrase in ("rear naked choke", "spinning back kick", "split decision", "title shot", "fight iq", "메인 이벤트"):
        if phrase in phrase_text:
            phrase_hits += 2
    return token_hits + phrase_hits


def detect_content_profile_from_text(text: str) -> str:
    return CONTENT_PROFILE_COMBAT_SPORTS if combat_sports_signal_score(text) >= 4 else CONTENT_PROFILE_GENERAL
