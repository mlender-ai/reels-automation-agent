import { describe, expect, it } from "vitest";

import { MAX_UPLOAD_SIZE_BYTES, validateSelectedVideo } from "./uploadValidation";

describe("validateSelectedVideo", () => {
  it("accepts a supported mp4 file", () => {
    expect(validateSelectedVideo({ name: "episode.mp4", size: 12 * 1024 * 1024, type: "video/mp4" })).toBeNull();
  });

  it("지원하지 않는 확장자를 거부한다", () => {
    expect(validateSelectedVideo({ name: "notes.txt", size: 1024, type: "text/plain" })).toContain("지원하지 않는 영상 형식");
  });

  it("용량이 큰 파일을 거부한다", () => {
    expect(validateSelectedVideo({ name: "huge.mov", size: MAX_UPLOAD_SIZE_BYTES + 1, type: "video/quicktime" })).toContain(
      "파일 용량이 너무 큽니다",
    );
  });

  it("확장자가 맞아도 지원하지 않는 mime 타입이면 거부한다", () => {
    expect(validateSelectedVideo({ name: "episode.mp4", size: 1024, type: "text/plain" })).toContain("지원하지 않습니다");
  });
});
