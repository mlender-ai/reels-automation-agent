import { describe, expect, it } from "vitest";

import { validateClipWindow } from "./clipValidation";

describe("validateClipWindow", () => {
  it("accepts a valid clip window", () => {
    expect(validateClipWindow(10, 28, 120)).toBeNull();
  });

  it("음수 시간은 거부한다", () => {
    expect(validateClipWindow(-1, 20, 120)).toContain("0초 이상");
  });

  it("원본 길이를 넘는 구간은 거부한다", () => {
    expect(validateClipWindow(10, 55, 40)).toContain("원본 영상 길이");
  });
});
