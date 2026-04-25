import type {
  ClipCandidate,
  DashboardSummary,
  ExportRecord,
  Project,
  PublishJob,
  PublishQueueResponse,
  SystemStatus,
  Transcript,
  WorkflowJob,
} from "../types";
import { request, requestForm } from "./client";

export const api = {
  getSystemStatus: () => request<SystemStatus>("/system/status"),
  getDashboardSummary: () => request<DashboardSummary>("/dashboard/summary"),
  listProjects: () => request<Project[]>("/projects"),
  createProject: (payload: { title: string; source_type?: string }) =>
    request<Project>("/projects", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getProject: (projectId: number) => request<Project>(`/projects/${projectId}`),
  listProjectJobs: (projectId: number) => request<WorkflowJob[]>(`/projects/${projectId}/jobs`),
  uploadProjectVideo: (projectId: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return requestForm<Project>(`/projects/${projectId}/upload`, formData);
  },
  getProjectTranscript: (projectId: number) => request<Transcript>(`/projects/${projectId}/transcript`),
  transcribeProject: (projectId: number) => request<Transcript>(`/projects/${projectId}/transcribe`, { method: "POST" }),
  startProjectTranscriptionJob: (projectId: number) =>
    request<WorkflowJob>(`/projects/${projectId}/transcribe/start`, { method: "POST" }),
  generateProjectClips: (projectId: number) =>
    request<ClipCandidate[]>(`/projects/${projectId}/generate-clips`, { method: "POST" }),
  startProjectClipGenerationJob: (projectId: number) =>
    request<WorkflowJob>(`/projects/${projectId}/generate-clips/start`, { method: "POST" }),
  listProjectClips: (projectId: number) => request<ClipCandidate[]>(`/projects/${projectId}/clips`),
  listClips: (statuses?: string[]) =>
    request<ClipCandidate[]>(statuses?.length ? `/clips?statuses=${statuses.join(",")}` : "/clips"),
  getClip: (clipId: number) => request<ClipCandidate>(`/clips/${clipId}`),
  listClipJobs: (clipId: number) => request<WorkflowJob[]>(`/clips/${clipId}/jobs`),
  getWorkflowJob: (jobId: number) => request<WorkflowJob>(`/jobs/${jobId}`),
  updateClip: (
    clipId: number,
    payload: {
      start_time?: number;
      end_time?: number;
      suggested_title?: string;
      suggested_description?: string;
      suggested_hashtags?: string;
      subtitle_preset?: string;
    },
  ) =>
    request<ClipCandidate>(`/clips/${clipId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  approveClip: (clipId: number) => request<ClipCandidate>(`/clips/${clipId}/approve`, { method: "POST" }),
  rejectClip: (clipId: number) => request<ClipCandidate>(`/clips/${clipId}/reject`, { method: "POST" }),
  resetClipReview: (clipId: number) => request<ClipCandidate>(`/clips/${clipId}/reset-review`, { method: "POST" }),
  exportClip: (clipId: number) => request<ExportRecord>(`/clips/${clipId}/export`, { method: "POST" }),
  startClipExportJob: (clipId: number) => request<WorkflowJob>(`/clips/${clipId}/export/start`, { method: "POST" }),
  listExports: () => request<ExportRecord[]>("/exports"),
  listPublishJobs: () => request<PublishQueueResponse>("/publish-jobs"),
  queuePublish: (clipId: number, platform: string) =>
    request<PublishJob>(`/clips/${clipId}/queue-publish`, {
      method: "POST",
      body: JSON.stringify({ platform }),
    }),
  startClipPublishJob: (clipId: number, platform: string) =>
    request<WorkflowJob>(`/clips/${clipId}/queue-publish/start`, {
      method: "POST",
      body: JSON.stringify({ platform }),
    }),
};
