import { Link } from "react-router-dom";

import type { Project } from "../types";
import { formatDateTime, nextActionLabel } from "../lib/formatters";
import { StatusBadge } from "./StatusBadge";

type ProjectSummaryCardProps = {
  project: Project;
};

export function ProjectSummaryCard({ project }: ProjectSummaryCardProps) {
  return (
    <Link to={`/projects/${project.id}`} className="block rounded-3xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-cyan-300/30 hover:bg-white/[0.06]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">프로젝트</p>
          <h3 className="mt-2 text-lg font-semibold text-white">{project.title}</h3>
        </div>
        <StatusBadge status={project.status} />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3 text-sm text-slate-300">
        <div className="rounded-2xl bg-black/20 p-3">
          <p className="text-xs text-slate-500">후보</p>
          <p className="mt-2 text-lg font-semibold text-white">{project.clip_count}</p>
        </div>
        <div className="rounded-2xl bg-black/20 p-3">
          <p className="text-xs text-slate-500">대기</p>
          <p className="mt-2 text-lg font-semibold text-white">{project.pending_clip_count}</p>
        </div>
        <div className="rounded-2xl bg-black/20 p-3">
          <p className="text-xs text-slate-500">내보내기</p>
          <p className="mt-2 text-lg font-semibold text-white">{project.export_count}</p>
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-cyan-300/10 bg-cyan-300/5 px-3 py-2 text-xs text-cyan-100">
        다음 단계: {nextActionLabel(project.next_action)}
      </div>
      <p className="mt-4 text-xs text-slate-500">업데이트 {formatDateTime(project.updated_at)}</p>
    </Link>
  );
}
