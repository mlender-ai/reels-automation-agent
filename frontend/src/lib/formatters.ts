export function formatDateTime(value?: string | null) {
  if (!value) return "없음";
  return new Date(value).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDuration(seconds?: number | null) {
  if (seconds == null || Number.isNaN(seconds)) return "--";
  const total = Math.max(0, Math.round(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function formatScore(score: number) {
  return score.toFixed(1);
}

export function truncate(text: string, length = 120) {
  if (text.length <= length) return text;
  return `${text.slice(0, length - 3).trimEnd()}...`;
}

export function nextActionLabel(nextAction?: string) {
  switch (nextAction) {
    case "transcribe":
      return "자막 추출 실행";
    case "generate_clips":
      return "클립 후보 생성";
    case "review_clips":
      return "후보 검토 진행";
    case "export_or_publish":
      return "내보내기 또는 게시 큐";
    default:
      return "원본 영상 업로드";
  }
}

export function workflowJobTypeLabel(jobType: string) {
  switch (jobType) {
    case "transcribe":
      return "자막 추출";
    case "generate_clips":
      return "클립 후보 생성";
    case "export":
      return "세로형 내보내기";
    case "publish":
      return "게시 큐";
    default:
      return jobType.replace(/_/g, " ");
  }
}
