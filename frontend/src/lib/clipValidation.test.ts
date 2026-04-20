import { describe, expect, it } from "vitest";

import { validateClipWindow } from "./clipValidation";

describe("validateClipWindow", () => {
  it("accepts a valid clip window", () => {
    expect(validateClipWindow(10, 28, 120)).toBeNull();
  });

  it("rejects negative times", () => {
    expect(validateClipWindow(-1, 20, 120)).toContain("zero or greater");
  });

  it("rejects windows that exceed the source duration", () => {
    expect(validateClipWindow(10, 55, 40)).toContain("source video duration");
  });
});
