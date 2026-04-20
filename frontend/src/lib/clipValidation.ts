const MIN_CLIP_DURATION_SECONDS = 8;
const MAX_CLIP_DURATION_SECONDS = 45;

export function validateClipWindow(startTime: number, endTime: number, sourceDuration?: number | null): string | null {
  if (startTime < 0 || endTime < 0) {
    return "시작 시간과 종료 시간은 0초 이상이어야 합니다.";
  }

  if (endTime <= startTime) {
    return "종료 시간은 시작 시간보다 커야 합니다.";
  }

  const duration = endTime - startTime;
  if (duration < MIN_CLIP_DURATION_SECONDS) {
    return "클립 길이는 최소 8초 이상이어야 자연스럽게 검토할 수 있습니다.";
  }

  if (duration > MAX_CLIP_DURATION_SECONDS) {
    return "내보내기 준비를 위해 클립 길이는 45초 이하로 유지해 주세요.";
  }

  if (typeof sourceDuration === "number" && endTime > sourceDuration + 0.25) {
    return `종료 시간은 원본 영상 길이(${sourceDuration.toFixed(1)}초) 안에 있어야 합니다.`;
  }

  return null;
}
