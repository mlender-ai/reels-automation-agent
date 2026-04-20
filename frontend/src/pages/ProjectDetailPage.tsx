import { Sparkles, Subtitles, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api } from "../api";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../hooks/useToast";
import { formatDateTime, formatDuration, nextActionLabel, truncate } from "../lib/formatters";
import { resolveMediaUrl } from "../lib/media";
import type { Project } from "../types";

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<"transcribe" | "clips" | null>(null);
  const [pageError, setPageError] = useState("");
  const [actionNotice, setActionNotice] = useState<{ tone: "error" | "info"; title: string; description: string } | null>(null);
  const navigate = useNavigate();
  const { pushToast } = useToast();

  async function loadProject() {
    if (!projectId) return;
    try {
      setLoading(true);
      setPageError("");
      setProject(await api.getProject(Number(projectId)));
    } catch (error) {
      const message = (error as Error).message;
      setPageError(message);
      pushToast({ tone: "error", title: "Project failed to load", description: message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProject();
  }, [projectId]);

  async function handleTranscribe() {
    if (!projectId) return;
    try {
      setBusyAction("transcribe");
      setActionNotice(null);
      await api.transcribeProject(Number(projectId));
      await loadProject();
      pushToast({ tone: "success", title: "Transcript ready", description: "You can now generate ranked shortform clip candidates." });
    } catch (error) {
      const message = (error as Error).message;
      setActionNotice({
        tone: "error",
        title: "Transcription failed",
        description: `${message} Retry after checking the source video's audio track or your local faster-whisper setup.`,
      });
      pushToast({ tone: "error", title: "Transcription failed", description: message });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleGenerateClips() {
    if (!projectId) return;
    try {
      setBusyAction("clips");
      setActionNotice(null);
      await api.generateProjectClips(Number(projectId));
      pushToast({ tone: "success", title: "Clip candidates created", description: "Top moments are ready for review." });
      navigate(`/projects/${projectId}/clips`);
    } catch (error) {
      const message = (error as Error).message;
      setActionNotice({
        tone: "error",
        title: "Clip generation failed",
        description: `${message} Review the transcript content, then retry or regenerate the transcript from a clearer source video.`,
      });
      pushToast({ tone: "error", title: "Clip generation failed", description: message });
    } finally {
      setBusyAction(null);
    }
  }

  if (loading) return <LoadingState label="Loading project..." />;
  if (!project) {
    if (pageError) {
      return <ErrorState title="Project unavailable" description={pageError} actionLabel="Retry project" onAction={() => void loadProject()} />;
    }
    return <EmptyState title="Project not found" description="This project could not be loaded from the local API." />;
  }

  const hasSource = Boolean(project.source_video);
  const hasTranscript = Boolean(project.latest_transcript);
  const hasClips = project.clip_count > 0;

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
            <StatusBadge status={project.status} />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl bg-black/20 p-4">
              <p className="text-xs text-slate-500">Transcript</p>
              <p className="mt-2 text-lg font-semibold text-white">{hasTranscript ? "Ready" : "Missing"}</p>
            </div>
            <div className="rounded-3xl bg-black/20 p-4">
              <p className="text-xs text-slate-500">Clip Candidates</p>
              <p className="mt-2 text-lg font-semibold text-white">{project.clip_count}</p>
              <p className="mt-2 text-xs text-slate-500">{project.pending_clip_count} pending · {project.approved_clip_count} approved</p>
            </div>
            <div className="rounded-3xl bg-black/20 p-4">
              <p className="text-xs text-slate-500">Exports</p>
              <p className="mt-2 text-lg font-semibold text-white">{project.export_count}</p>
              <p className="mt-2 text-xs text-slate-500">{project.rejected_clip_count} rejected tracked</p>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-cyan-300/15 bg-cyan-300/8 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">Next action</p>
            <p className="mt-2 text-sm font-medium text-cyan-100">{nextActionLabel(project.next_action)}</p>
          </div>

          {project.status === "failed" || actionNotice ? (
            <div className="mt-6 rounded-3xl border border-rose-400/20 bg-rose-400/10 px-4 py-4 text-rose-100">
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
              disabled={!hasSource || busyAction !== null}
              onClick={handleTranscribe}
              className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Subtitles className="h-4 w-4" />
              {busyAction === "transcribe" ? "Transcribing..." : hasTranscript ? "Regenerate Transcript" : "Extract Transcript"}
            </button>
            <button
              type="button"
              disabled={!hasTranscript || busyAction !== null}
              onClick={handleGenerateClips}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm font-medium text-emerald-200 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Wand2 className="h-4 w-4" />
              {busyAction === "clips" ? "Generating..." : hasClips ? "Regenerate Clip Candidates" : "Generate Clip Candidates"}
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
                <video
                  controls
                  src={resolveMediaUrl(project.source_video.file_url)}
                  className="aspect-video w-full bg-black object-contain"
                />
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
    </div>
  );
}
