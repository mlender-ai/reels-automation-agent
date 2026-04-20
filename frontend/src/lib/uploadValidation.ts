export const MAX_UPLOAD_SIZE_MB = 2048;
export const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;
export const ALLOWED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".m4v", ".webm", ".mkv"];
export const ALLOWED_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-m4v",
  "video/webm",
  "video/x-matroska",
  "video/mkv",
  "application/octet-stream",
];
export const ACCEPTED_VIDEO_INPUT = ".mp4,.mov,.m4v,.webm,.mkv,video/mp4,video/quicktime,video/x-m4v,video/webm,video/x-matroska";

export type UploadCandidate = {
  name: string;
  size: number;
  type?: string;
};

export function validateSelectedVideo(file: UploadCandidate): string | null {
  const lowered = file.name.toLowerCase();
  const hasAllowedExtension = ALLOWED_VIDEO_EXTENSIONS.some((extension) => lowered.endsWith(extension));
  if (!hasAllowedExtension) {
    return `지원하지 않는 영상 형식입니다. 다음 형식만 업로드할 수 있습니다: ${ALLOWED_VIDEO_EXTENSIONS.join(", ")}`;
  }

  if (file.type && !ALLOWED_VIDEO_MIME_TYPES.includes(file.type)) {
    return `선택한 파일 형식은 지원하지 않습니다. 허용되는 MIME 타입: ${ALLOWED_VIDEO_MIME_TYPES.filter((value) => value !== "application/octet-stream").join(", ")}`;
  }

  if (file.size <= 0) {
    return "선택한 파일이 비어 있습니다.";
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return `파일 용량이 너무 큽니다. ${MAX_UPLOAD_SIZE_MB}MB 이하만 업로드해 주세요.`;
  }

  return null;
}
