const MIN_CLIP_DURATION_SECONDS = 8;
const MAX_CLIP_DURATION_SECONDS = 45;

export function validateClipWindow(startTime: number, endTime: number, sourceDuration?: number | null): string | null {
  if (startTime < 0 || endTime < 0) {
    return "Start and end times must be zero or greater.";
  }

  if (endTime <= startTime) {
    return "End time must be greater than start time.";
  }

  const duration = endTime - startTime;
  if (duration < MIN_CLIP_DURATION_SECONDS) {
    return "Clip duration should stay above 8 seconds so the review moment still makes sense.";
  }

  if (duration > MAX_CLIP_DURATION_SECONDS) {
    return "Keep the review clip at 45 seconds or less so it remains export-ready.";
  }

  if (typeof sourceDuration === "number" && endTime > sourceDuration + 0.25) {
    return `End time must stay within the source video duration (${sourceDuration.toFixed(1)}s).`;
  }

  return null;
}
