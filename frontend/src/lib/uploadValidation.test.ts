import { describe, expect, it } from "vitest";

import { MAX_UPLOAD_SIZE_BYTES, validateSelectedVideo } from "./uploadValidation";

describe("validateSelectedVideo", () => {
  it("accepts a supported mp4 file", () => {
    expect(validateSelectedVideo({ name: "episode.mp4", size: 12 * 1024 * 1024, type: "video/mp4" })).toBeNull();
  });

  it("rejects unsupported file extensions", () => {
    expect(validateSelectedVideo({ name: "notes.txt", size: 1024, type: "text/plain" })).toContain("Unsupported video type");
  });

  it("rejects oversized files", () => {
    expect(validateSelectedVideo({ name: "huge.mov", size: MAX_UPLOAD_SIZE_BYTES + 1, type: "video/quicktime" })).toContain(
      "too large",
    );
  });
});
