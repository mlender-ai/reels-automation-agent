import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../components/ToastProvider";
import type { Project, WorkflowJob } from "../types";
import { api } from "../api";
import { ProjectDetailPage } from "./ProjectDetailPage";

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
    getProject: vi.fn(),
    listProjectJobs: vi.fn(),
    startProjectTranscriptionJob: vi.fn(),
    startProjectClipGenerationJob: vi.fn(),
  },
}));

function makeProject(): Project {
  return {
    id: 3,
    title: "Workflow test project",
    source_type: "upload",
    source_path: "projects/3/source/demo.mp4",
    status: "uploaded",
    created_at: "2026-04-20T00:00:00Z",
    updated_at: "2026-04-20T00:00:00Z",
    clip_count: 0,
    pending_clip_count: 0,
    rejected_clip_count: 0,
    approved_clip_count: 0,
    export_count: 0,
    next_action: "transcribe",
    source_video: {
      id: 1,
      project_id: 3,
      original_filename: "demo.mp4",
      stored_path: "projects/3/source/demo.mp4",
      file_url: "/files/projects/3/source/demo.mp4",
      duration_seconds: 120,
      width: 1920,
      height: 1080,
      fps: 30,
      created_at: "2026-04-20T00:00:00Z",
    },
    latest_transcript: null,
    latest_export: null,
  };
}

function makeJob(overrides: Partial<WorkflowJob> = {}): WorkflowJob {
  return {
    id: 7,
    project_id: 3,
    clip_candidate_id: null,
    job_type: "transcribe",
    status: "queued",
    progress: 0,
    message: "Transcript extraction has been queued",
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

function renderProjectDetail() {
  return render(
    <MemoryRouter initialEntries={["/projects/3"]}>
      <ToastProvider>
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("ProjectDetailPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    vi.mocked(api.getProject).mockReset();
    vi.mocked(api.listProjectJobs).mockReset();
    vi.mocked(api.startProjectTranscriptionJob).mockReset();
    vi.mocked(api.startProjectClipGenerationJob).mockReset();
  });

  it("queues transcript extraction and shows an automation activity notice", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getProject).mockResolvedValue(makeProject());
    vi.mocked(api.listProjectJobs).mockResolvedValue([]);
    vi.mocked(api.startProjectTranscriptionJob).mockResolvedValue(makeJob());

    renderProjectDetail();

    expect(await screen.findByText("Workflow test project")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Extract Transcript/i }));

    expect((await screen.findAllByText("Transcript queued")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/background transcription has started/i).length).toBeGreaterThan(0);
    expect(api.startProjectTranscriptionJob).toHaveBeenCalledWith(3);
  });
});
