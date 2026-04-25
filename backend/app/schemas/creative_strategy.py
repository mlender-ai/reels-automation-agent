from pydantic import BaseModel


class ShortformFormatVariantRead(BaseModel):
    id: str
    label: str
    summary: str
    visual_direction: str
    edit_rhythm: str
    sample_title: str
    sample_caption: str
    search_prompt: str
    source_clip_id: int
    source_clip_range: str
    confidence_label: str


class ShortformScriptIdeaRead(BaseModel):
    id: str
    label: str
    format_label: str
    title: str
    hook: str
    opening_line: str
    beat_plan: list[str]
    closing_line: str
    cta: str
    hashtags: str
    why_it_can_work: str
    source_clip_id: int
    source_clip_range: str


class ProjectCreativeStrategyRead(BaseModel):
    project_id: int
    strategy_focus: str
    format_variants: list[ShortformFormatVariantRead]
    script_ideas: list[ShortformScriptIdeaRead]
