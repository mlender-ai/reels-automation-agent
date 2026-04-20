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
    return `Unsupported video type. Use one of: ${ALLOWED_VIDEO_EXTENSIONS.join(", ")}`;
  }

  if (file.type && !ALLOWED_VIDEO_MIME_TYPES.includes(file.type)) {
    return `The selected file type is not supported. Expected one of: ${ALLOWED_VIDEO_MIME_TYPES.filter((value) => value !== "application/octet-stream").join(", ")}`;
  }

  if (file.size <= 0) {
    return "The selected file is empty.";
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return `File is too large. Keep uploads under ${MAX_UPLOAD_SIZE_MB} MB.`;
  }

  return null;
}
