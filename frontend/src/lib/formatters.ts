export function formatDateTime(value?: string | null) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString([], {
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
      return "Run transcript extraction";
    case "generate_clips":
      return "Generate clip candidates";
    case "review_clips":
      return "Review pending clips";
    case "export_or_publish":
      return "Export or queue publish";
    default:
      return "Upload a source video";
  }
}
