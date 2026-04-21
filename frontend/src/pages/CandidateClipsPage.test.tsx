import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../components/ToastProvider";
import type { ClipCandidate, Project } from "../types";
import { api } from "../api";
import { CandidateClipsPage } from "./CandidateClipsPage";

vi.mock("../api", () => ({
  api: {
    getProject: vi.fn(),
    listProjectClips: vi.fn(),
    approveClip: vi.fn(),
    rejectClip: vi.fn(),
  },
}));

function makeProject(): Project {
  return {
    id: 4,
    title: "Rejected only project",
    source_type: "upload",
    source_path: "projects/4/source/demo.mp4",
    status: "ready_for_review",
    created_at: "2026-04-20T00:00:00Z",
    updated_at: "2026-04-20T00:00:00Z",
    clip_count: 2,
    pending_clip_count: 0,
    rejected_clip_count: 2,
    approved_clip_count: 0,
    export_count: 0,
    next_action: "review_clips",
  };
}

function makeRejectedClip(id: number): ClipCandidate {
  return {
    id,
    project_id: 4,
    start_time: 8,
    end_time: 20,
    duration: 12,
    score: 70,
    hook_text: "Hook",
    suggested_title: `Clip ${id}`,
    suggested_description: "Rejected clip",
    suggested_hashtags: "#shorts",
    subtitle_preset: "clean",
    status: "rejected",
    created_at: "2026-04-20T00:00:00Z",
    updated_at: "2026-04-20T00:00:00Z",
    latest_export: null,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/projects/4/clips"]}>
      <ToastProvider>
        <Routes>
          <Route path="/projects/:projectId/clips" element={<CandidateClipsPage />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("CandidateClipsPage", () => {
  beforeEach(() => {
    vi.mocked(api.getProject).mockReset();
    vi.mocked(api.listProjectClips).mockReset();
    vi.mocked(api.approveClip).mockReset();
    vi.mocked(api.rejectClip).mockReset();
  });

  it("모든 후보가 반려 상태이면 재생성 안내를 보여준다", async () => {
    vi.mocked(api.getProject).mockResolvedValue(makeProject());
    vi.mocked(api.listProjectClips).mockResolvedValue([makeRejectedClip(1), makeRejectedClip(2)]);

    renderPage();

    expect(await screen.findByText("Rejected only project")).toBeInTheDocument();
    expect(screen.getByText("검토 가능한 후보가 현재 없습니다")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "프로젝트 상세로 이동" })).toHaveAttribute("href", "/projects/4");
  });
});
