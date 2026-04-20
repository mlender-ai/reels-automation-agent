import { Sparkles, Subtitles, Wand2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api } from "../api";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { StatusBadge } from "../components/StatusBadge";
import { WorkflowJobList } from "../components/WorkflowJobList";
import { useInterval } from "../hooks/useInterval";
import { useToast } from "../hooks/useToast";
import { formatDateTime, formatDuration, nextActionLabel, truncate, workflowJobTypeLabel } from "../lib/formatters";
import { resolveMediaUrl } from "../lib/media";
import type { Project, WorkflowJob } from "../types";

const ACTIVE_JOB_STATUSES = new Set(["queued", "running"]);

function upsertJob(jobs: WorkflowJob[], job: WorkflowJob) {
  return [job, ...jobs.filter((candidate) => candidate.id !== job.id)].sort(
    (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  );
}

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [jobs, setJobs] = useState<WorkflowJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingAction, setSubmittingAction] = useState<"transcribe" | "generate_clips" | null>(null);
  const [pageError, setPageError] = useState("");
  const [actionNotice, setActionNotice] = useState<{ tone: "error" | "info" | "success"; title: string; description: string } | null>(null);
  const [navigateOnClipReady, setNavigateOnClipReady] = useState(false);
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const seededJobIdsRef = useRef(false);
  const announcedJobIdsRef = useRef<Set<number>>(new Set());

  const projectIdNumber = Number(projectId);
  const relevantJobs = useMemo(() => jobs.filter((job) => job.job_type === "transcribe" || job.job_type === "generate_clips"), [jobs]);
  const activeProjectJob = useMemo(
    () => relevantJobs.find((job) => ACTIVE_JOB_STATUSES.has(job.status)) ?? null,
    [relevantJobs],
  );

  async function loadProject(options: { silent?: boolean } = {}) {
    if (!projectId) return;
    try {
      if (!options.silent) setLoading(true);
      setPageError("");
      setProject(await api.getProject(projectIdNumber));
    } catch (error) {
      const message = (error as Error).message;
      setPageError(message);
      pushToast({ tone: "error", title: "Project failed to load", description: message });
    } finally {
      if (!options.silent) setLoading(false);
    }
  }

  async function loadJobs() {
    if (!projectId) return;
    setJobs(await api.listProjectJobs(projectIdNumber));
  }

  async function loadPage() {
    if (!projectId) return;
    try {
      setLoading(true);
      setPageError("");
      const [projectResponse, jobsResponse] = await Promise.all([api.getProject(projectIdNumber), api.listProjectJobs(projectIdNumber)]);
      setProject(projectResponse);
      setJobs(jobsResponse);
    } catch (error) {
      const message = (error as Error).message;
      setPageError(message);
      pushToast({ tone: "error", title: "Project failed to load", description: message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPage();
  }, [projectId]);

  useEffect(() => {
    if (loading || seededJobIdsRef.current === true) return;
    announcedJobIdsRef.current = new Set(jobs.map((job) => job.id));
    seededJobIdsRef.current = true;
  }, [jobs, loading]);

  useInterval(
    () => {
      void loadJobs();
      void loadProject({ silent: true });
    },
    projectId && activeProjectJob ? 2000 : null,
  );

  useEffect(() => {
    if (!seededJobIdsRef.current) return;
    const terminalJobs = relevantJobs.filter((job) => !ACTIVE_JOB_STATUSES.has(job.status) && !announcedJobIdsRef.current.has(job.id));
    for (const job of terminalJobs) {
      announcedJobIdsRef.current.add(job.id);
      if (job.status === "completed") {
        const description =
          job.job_type === "generate_clips"
            ? "Fresh clip candidates are ready for review."
            : "Transcript extraction completed and the project is ready for the next step.";
        setActionNotice({ tone: "success", title: `${workflowJobTypeLabel(job.job_type)} completed`, description });
        pushToast({ tone: "success", title: `${workflowJobTypeLabel(job.job_type)} completed`, description });
        if (job.job_type === "generate_clips" && navigateOnClipReady) {
          setNavigateOnClipReady(false);
          navigate(`/projects/${projectId}/clips`);
        }
      } else if (job.status === "failed") {
        const description = job.error_detail ?? "Check the local runtime tools and source media, then retry this automation step.";
        setActionNotice({ tone: "error", title: `${workflowJobTypeLabel(job.job_type)} failed`, description });
        pushToast({ tone: "error", title: `${workflowJobTypeLabel(job.job_type)} failed`, description });
        if (job.job_type === "generate_clips") {
          setNavigateOnClipReady(false);
        }
      }
    }
  }, [jobs, navigateOnClipReady, projectId, pushToast, relevantJobs, navigate]);

  async function handleTranscribe() {
    if (!projectId) return;
    try {
      setSubmittingAction("transcribe");
      setActionNotice(null);
      const job = await api.startProjectTranscriptionJob(projectIdNumber);
      setJobs((current) => upsertJob(current, job));
      setActionNotice({
        tone: "info",
        title: "Transcript queued",
        description: "Transcription is now running in the background. This page will refresh progress automatically.",
      });
      pushToast({ tone: "success", title: "Transcript queued", description: "Background transcription has started." });
    } catch (error) {
      const message = (error as Error).message;
      setActionNotice({
        tone: "error",
        title: "Transcription failed to start",
        description: `${message} Retry after checking the source video's audio track or your local faster-whisper setup.`,
      });
      pushToast({ tone: "error", title: "Transcription failed to start", description: message });
    } finally {
      setSubmittingAction(null);
    }
  }

  async function handleGenerateClips() {
    if (!projectId) return;
    try {
      setSubmittingAction("generate_clips");
      setActionNotice(null);
      const job = await api.startProjectClipGenerationJob(projectIdNumber);
      setJobs((current) => upsertJob(current, job));
      setNavigateOnClipReady(true);
      setActionNotice({
        tone: "info",
        title: "Clip generation queued",
        description: "Ranking runs in the background now. You will land on the candidate grid as soon as new clips are ready.",
      });
      pushToast({ tone: "success", title: "Clip generation queued", description: "Shortform ranking has started." });
    } catch (error) {
      const message = (error as Error).message;
      setActionNotice({
        tone: "error",
        title: "Clip generation failed to start",
        description: `${message} Review the transcript content, then retry or regenerate the transcript from a clearer source video.`,
      });
      pushToast({ tone: "error", title: "Clip generation failed to start", description: message });
    } finally {
      setSubmittingAction(null);
    }
  }

  if (loading) return <LoadingState label="Loading project..." />;
  if (!project) {
    if (pageError) {
      return <ErrorState title="Project unavailable" description={pageError} actionLabel="Retry project" onAction={() => void loadPage()} />;
    }
    return <EmptyState title="Project not found" description="This project could not be loaded from the local API." />;
  }

  const hasSource = Boolean(project.source_video);
  const hasTranscript = Boolean(project.latest_transcript);
  const hasClips = project.clip_count > 0;
  const workflowLock = Boolean(activeProjectJob || submittingAction);
  const nextActionText = activeProjectJob
    ? `${workflowJobTypeLabel(activeProjectJob.job_type)} is in progress`
    : nextActionLabel(project.next_action);

  return (
    <div className="space-y-8">
      <section className="grid gap-8 xl:grid-cols-[1.05fr,0.95fr]">
        <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-panel">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Project</p>
              <h3 className="mt-3 font-display text-3xl font-semibold text-white">{project.title}</h3>
              <p className="mt-3 text-sm text-slate-400">Created {formatDateTime(project.created_at)}</p>
            </div>
            <StatusBadge status={activeProjectJob?.status ?? project.status} />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-3xl bg-black/20 p-4">
              <p className="text-xs text-slate-500">Transcript</p>
              <p className="mt-2 text-lg font-semibold text-white">{hasTranscript ? "Ready" : "Missing"}</p>
            </div>
            <div className="rounded-3xl bg-black/20 p-4">
              <p className="text-xs text-slate-500">Clip Candidates</p>
              <p className="mt-2 text-lg font-semibold text-white">{project.clip_count}</p>
              <p className="mt-2 text-xs text-slate-500">
                {project.pending_clip_count} pending · {project.approved_clip_count} approved
              </p>
            </div>
            <div className="rounded-3xl bg-black/20 p-4">
              <p className="text-xs text-slate-500">Exports</p>
              <p className="mt-2 text-lg font-semibold text-white">{project.export_count}</p>
              <p className="mt-2 text-xs text-slate-500">{project.rejected_clip_count} rejected tracked</p>
            </div>
            <div className="rounded-3xl bg-black/20 p-4">
              <p className="text-xs text-slate-500">Automation</p>
              <p className="mt-2 text-lg font-semibold text-white">{activeProjectJob ? `${activeProjectJob.progress}%` : "Idle"}</p>
              <p className="mt-2 text-xs text-slate-500">{activeProjectJob?.message ?? "No background run in progress"}</p>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-cyan-300/15 bg-cyan-300/8 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">Next action</p>
            <p className="mt-2 text-sm font-medium text-cyan-100">{nextActionText}</p>
          </div>

          {project.status === "failed" || actionNotice ? (
            <div
              className={`mt-6 rounded-3xl border px-4 py-4 ${
                actionNotice?.tone === "success"
                  ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                  : actionNotice?.tone === "info"
                    ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-100"
                    : "border-rose-400/20 bg-rose-400/10 text-rose-100"
              }`}
            >
              <p className="text-sm font-semibold">{actionNotice?.title ?? "Last automation step needs attention"}</p>
              <p className="mt-2 text-sm leading-6 text-white/85">
                {actionNotice?.description ??
                  "The last project step failed. Check your local source file and runtime tools, then retry the next action from this screen."}
              </p>
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!hasSource || workflowLock}
              onClick={handleTranscribe}
              className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Subtitles className="h-4 w-4" />
              {activeProjectJob?.job_type === "transcribe"
                ? `${activeProjectJob.progress}% · Transcribing`
                : hasTranscript
                  ? "Regenerate Transcript"
                  : "Extract Transcript"}
            </button>
            <button
              type="button"
              disabled={!hasTranscript || workflowLock}
              onClick={handleGenerateClips}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm font-medium text-emerald-200 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Wand2 className="h-4 w-4" />
              {activeProjectJob?.job_type === "generate_clips"
                ? `${activeProjectJob.progress}% · Generating`
                : hasClips
                  ? "Regenerate Clip Candidates"
                  : "Generate Clip Candidates"}
            </button>
            {hasClips ? (
              <Link
                to={`/projects/${project.id}/clips`}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5"
              >
                <Sparkles className="h-4 w-4" />
                View Candidates
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white/45"
              >
                <Sparkles className="h-4 w-4" />
                View Candidates
              </button>
            )}
          </div>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-4 shadow-panel">
          {project.source_video?.file_url ? (
            <div>
              <div className="overflow-hidden rounded-[28px] border border-white/10 bg-black/30">
                <video controls src={resolveMediaUrl(project.source_video.file_url)} className="aspect-video w-full bg-black object-contain" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-2xl bg-black/20 p-3">
                  <p className="text-xs text-slate-500">Duration</p>
                  <p className="mt-2 font-semibold text-white">{formatDuration(project.source_video.duration_seconds)}</p>
                </div>
                <div className="rounded-2xl bg-black/20 p-3">
                  <p className="text-xs text-slate-500">Resolution</p>
                  <p className="mt-2 font-semibold text-white">
                    {project.source_video.width ?? "--"} x {project.source_video.height ?? "--"}
                  </p>
                </div>
                <div className="rounded-2xl bg-black/20 p-3">
                  <p className="text-xs text-slate-500">FPS</p>
                  <p className="mt-2 font-semibold text-white">{project.source_video.fps ?? "--"}</p>
                </div>
              </div>
              {project.latest_export?.output_url ? (
                <a
                  href={resolveMediaUrl(project.latest_export.output_url)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/15"
                >
                  Open latest export
                </a>
              ) : null}
            </div>
          ) : (
            <EmptyState
              title="Source missing"
              description="This project does not have an uploaded video yet. Go back to New Project to add the local source file."
            />
          )}
        </div>
      </section>

      <section className="grid gap-8 xl:grid-cols-[1fr,1fr]">
        <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6">
          <h3 className="font-display text-xl font-semibold text-white">Transcript Status</h3>
          {project.latest_transcript ? (
            <div className="mt-4 space-y-3">
              <StatusBadge status="transcribed" />
              <p className="text-sm leading-6 text-slate-300">{truncate(project.latest_transcript.text, 320)}</p>
              <p className="text-xs text-slate-500">
                Model {project.latest_transcript.model_name} · Language {project.latest_transcript.language ?? "auto"}
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-slate-400">
              Transcript has not been generated yet. Run the transcript step to unlock heuristic clip discovery.
            </p>
          )}
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6">
          <h3 className="font-display text-xl font-semibold text-white">Next Step Guide</h3>
          <div className="mt-4 space-y-4 text-sm leading-6 text-slate-300">
            <p>1. Extract or refresh the transcript whenever the source video changes.</p>
            <p>2. Generate candidates to refresh the review queue with stronger ranked shortform windows.</p>
            <p>3. Approve promising candidates, export a 1080x1920 MP4, and then queue a mock publish job.</p>
          </div>
        </div>
      </section>

      <WorkflowJobList
        jobs={relevantJobs}
        title="Automation Activity"
        description="These project-level runs update transcript extraction and clip candidate generation without blocking the page."
        emptyTitle="Transcript extraction and clip generation runs will appear here."
      />
    </div>
  );
}
