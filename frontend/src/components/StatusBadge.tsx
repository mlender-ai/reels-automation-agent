type StatusBadgeProps = {
  status: string;
};

const statusStyles: Record<string, string> = {
  draft: "bg-slate-500/20 text-slate-200",
  uploaded: "bg-sky-500/20 text-sky-200",
  transcribed: "bg-indigo-500/20 text-indigo-200",
  clips_generated: "bg-indigo-500/20 text-indigo-200",
  ready_for_review: "bg-amber-500/20 text-amber-200",
  approved: "bg-emerald-500/20 text-emerald-200",
  rejected: "bg-rose-500/20 text-rose-200",
  exported: "bg-cyan-500/20 text-cyan-200",
  processing: "bg-violet-500/20 text-violet-200",
  running: "bg-violet-500/20 text-violet-200",
  completed: "bg-emerald-500/20 text-emerald-200",
  queued: "bg-amber-500/20 text-amber-200",
  failed: "bg-rose-500/20 text-rose-200",
  posted: "bg-emerald-500/20 text-emerald-200",
  ready: "bg-cyan-500/20 text-cyan-200",
  not_connected: "bg-slate-500/20 text-slate-300",
  pending: "bg-amber-500/20 text-amber-200",
};

const statusLabels: Record<string, string> = {
  draft: "초안",
  uploaded: "업로드됨",
  transcribed: "자막 완료",
  clips_generated: "후보 생성됨",
  ready_for_review: "검토 대기",
  approved: "승인됨",
  rejected: "반려됨",
  exported: "내보내기 완료",
  processing: "처리 중",
  running: "실행 중",
  completed: "완료",
  queued: "대기열",
  failed: "실패",
  posted: "게시됨",
  ready: "준비됨",
  not_connected: "연결 전",
  pending: "대기",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium capitalize ${statusStyles[status] ?? "bg-white/10 text-white"}`}>
      {statusLabels[status] ?? status.replace(/_/g, " ")}
    </span>
  );
}
