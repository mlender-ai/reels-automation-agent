import { formatDateTime, workflowJobTypeLabel } from "../lib/formatters";
import type { WorkflowJob } from "../types";
import { StatusBadge } from "./StatusBadge";

type WorkflowJobListProps = {
  jobs: WorkflowJob[];
  title: string;
  description: string;
  emptyTitle?: string;
};

export function WorkflowJobList({ jobs, title, description, emptyTitle = "아직 자동화 실행 기록이 없습니다." }: WorkflowJobListProps) {
  return (
    <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-xl font-semibold text-white">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-slate-300">{jobs.length}건</span>
      </div>

      {jobs.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-white/10 bg-black/15 px-4 py-5 text-sm leading-6 text-slate-400">{emptyTitle}</p>
      ) : (
        <div className="mt-5 space-y-4">
          {jobs.map((job) => (
            <div key={job.id} className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{workflowJobTypeLabel(job.job_type)}</p>
                  <p className="mt-1 text-xs text-slate-500">시작 {formatDateTime(job.started_at ?? job.created_at)}</p>
                </div>
                <StatusBadge status={job.status} />
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
                <div
                  className={`h-full rounded-full transition-all ${
                    job.status === "failed"
                      ? "bg-rose-400"
                      : job.status === "completed"
                        ? "bg-emerald-400"
                        : "bg-cyan-300"
                  }`}
                  style={{ width: `${Math.max(6, job.progress)}%` }}
                />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">{job.message ?? "다음 진행 상황을 기다리는 중입니다."}</p>
              {job.error_detail ? <p className="mt-2 text-sm leading-6 text-rose-200">{job.error_detail}</p> : null}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span>{job.progress}% 완료</span>
                {job.clip_title ? <span>클립: {job.clip_title}</span> : null}
                {job.completed_at ? <span>종료 {formatDateTime(job.completed_at)}</span> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
