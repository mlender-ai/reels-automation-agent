import { Link } from "react-router-dom";

import type { ShortformFormatVariant } from "../types";

type FormatVariantCardProps = {
  variant: ShortformFormatVariant;
};

export function FormatVariantCard({ variant }: FormatVariantCardProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">숏폼 형태</p>
          <h3 className="mt-3 text-xl font-semibold text-white">{variant.label}</h3>
        </div>
        <span className="rounded-full bg-emerald-400/12 px-3 py-1 text-xs font-medium text-emerald-100">{variant.confidence_label}</span>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-300">{variant.summary}</p>

      <div className="mt-5 rounded-3xl border border-white/8 bg-black/25 p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">샘플 타이틀</p>
        <p className="mt-2 text-lg font-semibold leading-tight text-white">{variant.sample_title}</p>
        <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-slate-500">샘플 자막</p>
        <p className="mt-2 text-sm font-medium leading-6 text-slate-100">{variant.sample_caption}</p>
      </div>

      <div className="mt-5 space-y-3 text-sm leading-6 text-slate-300">
        <p>
          <span className="text-slate-500">화면 연출</span>
          <br />
          {variant.visual_direction}
        </p>
        <p>
          <span className="text-slate-500">편집 리듬</span>
          <br />
          {variant.edit_rhythm}
        </p>
        <p>
          <span className="text-slate-500">검색/확장 키워드</span>
          <br />
          {variant.search_prompt}
        </p>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">기준 후보 {variant.source_clip_range}</p>
        <Link
          to={`/clips/${variant.source_clip_id}`}
          className="inline-flex rounded-2xl border border-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/5"
        >
          이 후보 보기
        </Link>
      </div>
    </div>
  );
}
