import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../components/ToastProvider";
import type { ClipCandidate, PublishQueueResponse } from "../types";
import { api } from "../api";
import { PublishQueuePage } from "./PublishQueuePage";

vi.mock("../api", () => ({
  api: {
    listPublishJobs: vi.fn(),
    listClips: vi.fn(),
    queuePublish: vi.fn(),
  },
}));

function makeClip(): ClipCandidate {
  return {
    id: 11,
    project_id: 1,
    start_time: 8,
    end_time: 28,
    duration: 20,
    score: 80,
    hook_text: "Hook",
    suggested_title: "Exported clip",
    suggested_description: "desc",
    suggested_hashtags: "#shorts",
    subtitle_preset: "clean",
    status: "exported",
    created_at: "2026-04-20T00:00:00Z",
    updated_at: "2026-04-20T00:00:00Z",
    latest_export: {
      id: 2,
      clip_candidate_id: 11,
      output_path: "projects/1/exports/clip.mp4",
      output_url: "/files/projects/1/exports/clip.mp4",
      subtitle_path: "projects/1/exports/clip.srt",
      subtitle_url: "/files/projects/1/exports/clip.srt",
      thumbnail_path: "projects/1/exports/clip.jpg",
      thumbnail_url: "/files/projects/1/exports/clip.jpg",
      status: "completed",
      created_at: "2026-04-20T00:00:00Z",
      updated_at: "2026-04-20T00:00:00Z",
    },
  };
}

function makeQueue(): PublishQueueResponse {
  return {
    platforms: [
      { platform: "youtube", adapter_name: "mock_youtube_adapter", status: "ready", account_label: "Local mock account" },
      { platform: "instagram", adapter_name: "mock_instagram_adapter", status: "ready", account_label: "Local mock account" },
      { platform: "tiktok", adapter_name: "mock_tiktok_adapter", status: "ready", account_label: "Local mock account" },
    ],
    items: [
      {
        id: 90,
        clip_candidate_id: 11,
        platform: "youtube",
        adapter_name: "mock_youtube_adapter",
        status: "failed",
        payload_json: null,
        result_json: { error: "Mock network issue" },
        created_at: "2026-04-20T00:00:00Z",
        updated_at: "2026-04-20T00:00:00Z",
        clip_title: "Exported clip",
        project_id: 1,
      },
    ],
  };
}

describe("PublishQueuePage", () => {
  beforeEach(() => {
    vi.mocked(api.listPublishJobs).mockReset();
    vi.mocked(api.listClips).mockReset();
    vi.mocked(api.queuePublish).mockReset();
  });

  it("실패한 게시 작업에 재시도 버튼을 보여주고 다시 등록할 수 있다", async () => {
    const user = userEvent.setup();
    vi.mocked(api.listPublishJobs).mockResolvedValue(makeQueue());
    vi.mocked(api.listClips).mockResolvedValue([makeClip()]);
    vi.mocked(api.queuePublish).mockResolvedValue({
      id: 91,
      clip_candidate_id: 11,
      platform: "youtube",
      adapter_name: "mock_youtube_adapter",
      status: "queued",
      payload_json: null,
      result_json: { queued: true },
      created_at: "2026-04-20T00:00:00Z",
      updated_at: "2026-04-20T00:00:00Z",
    });

    render(
      <MemoryRouter>
        <ToastProvider>
          <PublishQueuePage />
        </ToastProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("작업 현황")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "같은 조건으로 다시 등록" }));

    await waitFor(() => {
      expect(api.queuePublish).toHaveBeenCalledWith(11, "youtube");
    });
    expect(await screen.findByText("실패한 게시 작업을 다시 등록했습니다")).toBeInTheDocument();
  });
});
