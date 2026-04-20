import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, request } from "./client";

describe("api client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns parsed JSON on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true, count: 3 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const response = await request<{ ok: boolean; count: number }>("/health");
    expect(response).toEqual({ ok: true, count: 3 });
  });

  it("surfaces json detail messages on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "트랜스크립트 생성에 실패했습니다." }), {
          status: 422,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(request("/projects/1/transcribe")).rejects.toMatchObject({
      message: "트랜스크립트 생성에 실패했습니다.",
      status: 422,
    });
  });

  it("falls back to plain text errors when the backend is not returning json", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("Gateway timeout", {
          status: 504,
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );

    await expect(request("/exports")).rejects.toMatchObject({
      message: "Gateway timeout",
      status: 504,
    });
  });
});
