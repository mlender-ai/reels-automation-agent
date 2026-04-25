import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../components/ToastProvider";
import type { ClipCandidate, Project, WorkflowJob } from "../types";
import { api } from "../api";
import { ClipReviewPage } from "./ClipReviewPage";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../api", () => ({
  api: {
    getClip: vi.fn(),
    getProject: vi.fn(),
    listClipJobs: vi.fn(),
    startClipExportJob: vi.fn(),
    startClipPublishJob: vi.fn(),
    updateClip: vi.fn(),
    approveClip: vi.fn(),
    rejectClip: vi.fn(),
    resetClipReview: vi.fn(),
  },
}));

function makeProject(): Project {
  return {
    id: 1,
    title: "Review test project",
    source_type: "upload",
    source_path: "projects/1/source/demo.mp4",
    status: "ready_for_review",
    created_at: "2026-04-20T00:00:00Z",
    updated_at: "2026-04-20T00:00:00Z",
    clip_count: 1,
    pending_clip_count: 0,
    rejected_clip_count: 0,
    approved_clip_count: 1,
    export_count: 0,
    next_action: "export_or_publish",
    source_video: {
      id: 1,
      project_id: 1,
      original_filename: "demo.mp4",
      stored_path: "projects/1/source/demo.mp4",
      file_url: "/files/projects/1/source/demo.mp4",
      duration_seconds: 90,
      width: 1920,
      height: 1080,
      fps: 30,
      created_at: "2026-04-20T00:00:00Z",
    },
  };
}

function makeClip(overrides: Partial<ClipCandidate> = {}): ClipCandidate {
  return {
    id: 11,
    project_id: 1,
    start_time: 8,
    end_time: 28,
    duration: 20,
    score: 82,
    content_profile: "general",
    content_profile_label: "일반",
    recommended_format: "분석형",
    virality_label: "우선 검토",
    selection_reason: "테스트용 후보",
    selection_signals: ["테스트 신호"],
    timeline_label: "초반",
    hook_text: "Three mistakes kill retention in the first minute.",
    suggested_title: "Three retention mistakes",
    suggested_description: "A concise explanation of what hurts short-form retention.",
    suggested_hashtags: "#shorts #retention",
    subtitle_preset: "clean",
    status: "approved",
    created_at: "2026-04-20T00:00:00Z",
    updated_at: "2026-04-20T00:00:00Z",
    latest_export: null,
    ...overrides,
  };
}

function makeJob(overrides: Partial<WorkflowJob> = {}): WorkflowJob {
  return {
    id: 50,
    project_id: 1,
    clip_candidate_id: 11,
    job_type: "export",
    status: "queued",
    progress: 0,
    message: "Queued",
    error_detail: null,
    payload_json: null,
    result_json: { status: "queued" },
    started_at: null,
    completed_at: null,
    created_at: "2026-04-20T00:00:00Z",
    updated_at: "2026-04-20T00:00:00Z",
    ...overrides,
  };
}

function renderClipReview() {
  return render(
    <MemoryRouter initialEntries={["/clips/11"]}>
      <ToastProvider>
        <Routes>
          <Route path="/clips/:clipId" element={<ClipReviewPage />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("ClipReviewPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    vi.mocked(api.getProject).mockReset();
    vi.mocked(api.getClip).mockReset();
    vi.mocked(api.listClipJobs).mockReset();
    vi.mocked(api.startClipExportJob).mockReset();
    vi.mocked(api.startClipPublishJob).mockReset();
    vi.mocked(api.updateClip).mockReset();
    vi.mocked(api.approveClip).mockReset();
    vi.mocked(api.rejectClip).mockReset();
    vi.mocked(api.resetClipReview).mockReset();
  });

  it("내보내기 작업을 시작하면 인라인 대기열 안내를 보여준다", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getClip).mockResolvedValue(makeClip());
    vi.mocked(api.getProject).mockResolvedValue(makeProject());
    vi.mocked(api.listClipJobs).mockResolvedValue([]);
    vi.mocked(api.startClipExportJob).mockResolvedValue(
      makeJob({
        id: 77,
        job_type: "export",
        status: "queued",
        message: "Vertical export has been queued",
      }),
    );

    renderClipReview();

    expect(await screen.findByText("Review test project")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /1080x1920으로 내보내기/i }));

    expect((await screen.findAllByText("내보내기를 대기열에 등록했습니다")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/백그라운드 내보내기 작업이 시작되었습니다/i).length).toBeGreaterThan(0);
    expect(api.startClipExportJob).toHaveBeenCalledWith(11);
  });

  it("결과물이 있으면 게시 큐를 백그라운드 작업으로 등록한다", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getClip).mockResolvedValue(
      makeClip({
        status: "exported",
        latest_export: {
          id: 7,
          clip_candidate_id: 11,
          output_path: "projects/1/exports/clip-11.mp4",
          output_url: "/files/projects/1/exports/clip-11.mp4",
          subtitle_path: "projects/1/exports/clip-11.srt",
          subtitle_url: "/files/projects/1/exports/clip-11.srt",
          thumbnail_path: "projects/1/exports/clip-11.jpg",
          thumbnail_url: "/files/projects/1/exports/clip-11.jpg",
          status: "completed",
          created_at: "2026-04-20T00:00:00Z",
          updated_at: "2026-04-20T00:00:00Z",
        },
      }),
    );
    vi.mocked(api.getProject).mockResolvedValue(makeProject());
    vi.mocked(api.listClipJobs).mockResolvedValue([]);
    vi.mocked(api.startClipPublishJob).mockResolvedValue(
      makeJob({
        id: 88,
        job_type: "publish",
        status: "queued",
        payload_json: { platform: "youtube" },
        message: "Mock publish for youtube has been queued",
      }),
    );

    renderClipReview();

    expect(await screen.findByText("Review test project")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /youtube 큐에 넣기/i }));

    await waitFor(() => {
      expect(api.startClipPublishJob).toHaveBeenCalledWith(11, "youtube");
    });
    expect((await screen.findAllByText("게시 큐에 등록했습니다")).length).toBeGreaterThan(0);
  });

  it("승인된 클립은 검토 상태를 pending으로 되돌릴 수 있다", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getClip).mockResolvedValue(makeClip());
    vi.mocked(api.getProject).mockResolvedValue(makeProject());
    vi.mocked(api.listClipJobs).mockResolvedValue([]);
    vi.mocked(api.resetClipReview).mockResolvedValue(makeClip({ status: "pending" }));

    renderClipReview();

    expect(await screen.findByText("Review test project")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "검토 상태 되돌리기" }));

    await waitFor(() => {
      expect(api.resetClipReview).toHaveBeenCalledWith(11);
    });
    expect((await screen.findAllByText("검토 상태를 되돌렸습니다")).length).toBeGreaterThan(0);
  });
});
