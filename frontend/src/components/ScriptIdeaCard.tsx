import { Link } from "react-router-dom";

import type { ShortformScriptIdea } from "../types";

type ScriptIdeaCardProps = {
  idea: ShortformScriptIdea;
};

export function ScriptIdeaCard({ idea }: ScriptIdeaCardProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">스크립트 아이디어</p>
          <h3 className="mt-3 text-xl font-semibold text-white">{idea.label}</h3>
        </div>
        <span className="rounded-full bg-cyan-300/12 px-3 py-1 text-xs font-medium text-cyan-100">{idea.format_label}</span>
      </div>

      <div className="mt-5 space-y-4">
        <div className="rounded-3xl border border-white/8 bg-black/25 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">제목</p>
          <p className="mt-2 text-lg font-semibold leading-tight text-white">{idea.title}</p>
          <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-slate-500">첫 훅</p>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-100">{idea.hook}</p>
        </div>

        <div className="space-y-3 text-sm leading-6 text-slate-300">
          <p>
            <span className="text-slate-500">오프닝 멘트</span>
            <br />
            {idea.opening_line}
          </p>
          <div>
            <p className="text-slate-500">구성</p>
            <div className="mt-2 space-y-2">
              {idea.beat_plan.map((beat) => (
                <p key={beat} className="rounded-2xl bg-white/4 px-3 py-2 text-slate-200">
                  {beat}
                </p>
              ))}
            </div>
          </div>
          <p>
            <span className="text-slate-500">마무리</span>
            <br />
            {idea.closing_line}
          </p>
          <p>
            <span className="text-slate-500">왜 먹히는지</span>
            <br />
            {idea.why_it_can_work}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          기준 후보 {idea.source_clip_range}
          <br />
          {idea.hashtags}
        </div>
        <Link
          to={`/clips/${idea.source_clip_id}`}
          className="inline-flex rounded-2xl border border-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/5"
        >
          이 후보로 열기
        </Link>
      </div>
    </div>
  );
}
