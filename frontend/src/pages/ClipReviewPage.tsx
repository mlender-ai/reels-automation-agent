import { Check, Clock3, Download, ExternalLink, Save, Send, SkipBack, SkipForward, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { api } from "../api";
import { ConfirmModal } from "../components/ConfirmModal";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { StatusBadge } from "../components/StatusBadge";
import { WorkflowJobList } from "../components/WorkflowJobList";
import { useInterval } from "../hooks/useInterval";
import { useToast } from "../hooks/useToast";
import { formatDuration, workflowJobTypeLabel } from "../lib/formatters";
import { validateClipWindow } from "../lib/clipValidation";
import { resolveMediaUrl } from "../lib/media";
import type { ClipCandidate, Project, WorkflowJob } from "../types";

const presets = [
  { value: "clean", label: "Clean", note: "Balanced sizing and subtle outline." },
  { value: "bold", label: "Bold", note: "Higher contrast and stronger emphasis." },
  { value: "creator", label: "Creator", note: "Heavier treatment for social-first energy." },
];

const ACTIVE_JOB_STATUSES = new Set(["queued", "running"]);

function upsertJob(jobs: WorkflowJob[], job: WorkflowJob) {
  return [job, ...jobs.filter((candidate) => candidate.id !== job.id)].sort(
    (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  );
}

export function ClipReviewPage() {
  const { clipId } = useParams();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const [clip, setClip] = useState<ClipCandidate | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [jobs, setJobs] = useState<WorkflowJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [statusSubmitting, setStatusSubmitting] = useState<"approve" | "reject" | null>(null);
  const [pageError, setPageError] = useState("");
  const [actionNotice, setActionNotice] = useState<{ tone: "error" | "info" | "success"; title: string; description: string } | null>(
    null,
  );
  const [navigateOnExportCompletion, setNavigateOnExportCompletion] = useState(false);
  const [navigateOnPublishCompletion, setNavigateOnPublishCompletion] = useState(false);
  const sourcePreviewRef = useRef<HTMLVideoElement | null>(null);
  const seededJobIdsRef = useRef(false);
  const announcedJobIdsRef = useRef<Set<number>>(new Set());
  const [form, setForm] = useState({
    start_time: 0,
    end_time: 0,
    suggested_title: "",
    suggested_description: "",
    suggested_hashtags: "",
    subtitle_preset: "clean",
  });

  const previewUrl = useMemo(() => {
    if (clip?.latest_export?.output_url) return resolveMediaUrl(clip.latest_export.output_url);
    if (project?.source_video?.file_url) return resolveMediaUrl(project.source_video.file_url);
    return "";
  }, [clip?.latest_export?.output_url, project?.source_video?.file_url]);

  const validationError = useMemo(() => {
    return validateClipWindow(form.start_time, form.end_time, project?.source_video?.duration_seconds) ?? "";
  }, [form.end_time, form.start_time, project?.source_video?.duration_seconds]);

  const relevantJobs = useMemo(() => jobs.filter((job) => job.job_type === "export" || job.job_type === "publish"), [jobs]);
  const activeExportJob = useMemo(
    () => relevantJobs.find((job) => job.job_type === "export" && ACTIVE_JOB_STATUSES.has(job.status)) ?? null,
    [relevantJobs],
  );
  const activePublishJob = useMemo(
    () => relevantJobs.find((job) => job.job_type === "publish" && ACTIVE_JOB_STATUSES.has(job.status)) ?? null,
    [relevantJobs],
  );

  async function load(options: { silent?: boolean } = {}) {
    if (!clipId) return;
    try {
      if (!options.silent) setLoading(true);
      setPageError("");
      const clipResponse = await api.getClip(Number(clipId));
      const [projectResponse, jobsResponse] = await Promise.all([
        api.getProject(clipResponse.project_id),
        api.listClipJobs(Number(clipId)),
      ]);
      setClip(clipResponse);
      setProject(projectResponse);
      setJobs(jobsResponse);
      setForm({
        start_time: clipResponse.start_time,
        end_time: clipResponse.end_time,
        suggested_title: clipResponse.suggested_title,
        suggested_description: clipResponse.suggested_description,
        suggested_hashtags: clipResponse.suggested_hashtags,
        subtitle_preset: clipResponse.subtitle_preset,
      });
    } catch (error) {
      const message = (error as Error).message;
      setPageError(message);
      pushToast({ tone: "error", title: "Clip review failed to load", description: message });
    } finally {
      if (!options.silent) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [clipId]);

  useEffect(() => {
    if (loading || seededJobIdsRef.current === true) return;
    announcedJobIdsRef.current = new Set(jobs.map((job) => job.id));
    seededJobIdsRef.current = true;
  }, [jobs, loading]);

  useInterval(
    () => {
      void load({ silent: true });
    },
    clipId && (activeExportJob || activePublishJob) ? 2000 : null,
  );

  useEffect(() => {
    if (!seededJobIdsRef.current) return;
    const terminalJobs = relevantJobs.filter((job) => !ACTIVE_JOB_STATUSES.has(job.status) && !announcedJobIdsRef.current.has(job.id));
    for (const job of terminalJobs) {
      announcedJobIdsRef.current.add(job.id);
      if (job.status === "completed") {
        const description =
          job.job_type === "export"
            ? "The 1080x1920 MP4 is ready. You can review it from the exports page."
            : "The mock platform adapter accepted the clip and stored the publish job.";
        setActionNotice({ tone: "success", title: `${workflowJobTypeLabel(job.job_type)} completed`, description });
        pushToast({ tone: "success", title: `${workflowJobTypeLabel(job.job_type)} completed`, description });
        if (job.job_type === "export" && navigateOnExportCompletion) {
          setNavigateOnExportCompletion(false);
          navigate("/exports");
        }
        if (job.job_type === "publish" && navigateOnPublishCompletion) {
          setNavigateOnPublishCompletion(false);
          navigate("/publish");
        }
      } else if (job.status === "failed") {
        const description = job.error_detail ?? "Check the local runtime tools and export prerequisites, then try again.";
        setActionNotice({ tone: "error", title: `${workflowJobTypeLabel(job.job_type)} failed`, description });
        pushToast({ tone: "error", title: `${workflowJobTypeLabel(job.job_type)} failed`, description });
        if (job.job_type === "export") setNavigateOnExportCompletion(false);
        if (job.job_type === "publish") setNavigateOnPublishCompletion(false);
      }
    }
  }, [jobs, navigate, navigateOnExportCompletion, navigateOnPublishCompletion, pushToast, relevantJobs]);

  async function handleSave() {
    if (!clip) return;
    try {
      setSaving(true);
      setActionNotice(null);
      const updated = await api.updateClip(clip.id, form);
      setClip(updated);
      setActionNotice({
        tone: "success",
        title: "Saved",
        description: "Timing, metadata, and subtitle styling are now aligned with the next export.",
      });
      pushToast({ tone: "success", title: "Clip saved", description: "Timing, metadata, and subtitle preset were updated." });
    } catch (error) {
      const message = (error as Error).message;
      setActionNotice({ tone: "error", title: "Save failed", description: `${message} Adjust the timing and try again.` });
      pushToast({ tone: "error", title: "Save failed", description: message });
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    if (!clip) return;
    try {
      setStatusSubmitting("approve");
      setActionNotice(null);
      const updated = await api.approveClip(clip.id);
      setClip(updated);
      setActionNotice({ tone: "success", title: "Approved", description: "This clip is now ready for vertical export." });
      pushToast({ tone: "success", title: "Clip approved", description: "Export is now unlocked for this candidate." });
    } catch (error) {
      const message = (error as Error).message;
      setActionNotice({ tone: "error", title: "Approve failed", description: `${message} Retry once the local API is reachable again.` });
      pushToast({ tone: "error", title: "Approve failed", description: message });
    } finally {
      setStatusSubmitting(null);
    }
  }

  async function handleReject() {
    if (!clip) return;
    try {
      setStatusSubmitting("reject");
      setActionNotice(null);
      const updated = await api.rejectClip(clip.id);
      setClip(updated);
      setRejectOpen(false);
      setActionNotice({ tone: "info", title: "Rejected", description: "The clip remains editable, but it no longer looks ready for export." });
      pushToast({ tone: "info", title: "Clip rejected", description: "You can still return and edit it later if priorities change." });
    } catch (error) {
      const message = (error as Error).message;
      setActionNotice({ tone: "error", title: "Reject failed", description: `${message} Retry if you still want to remove it from the ready queue.` });
      pushToast({ tone: "error", title: "Reject failed", description: message });
    } finally {
      setStatusSubmitting(null);
    }
  }

  async function handleExport() {
    if (!clip) return;
    try {
      setActionNotice(null);
      const job = await api.startClipExportJob(clip.id);
      setJobs((current) => upsertJob(current, job));
      setNavigateOnExportCompletion(true);
      setActionNotice({
        tone: "info",
        title: "Export queued",
        description: "Vertical render now runs in the background. This screen will keep polling progress until the export lands in the exports list.",
      });
      pushToast({ tone: "success", title: "Export queued", description: "Background export has started." });
    } catch (error) {
      const message = (error as Error).message;
      setActionNotice({
        tone: "error",
        title: "Export failed to start",
        description: `${message} Check FFmpeg, local disk space, and clip timing, then retry export from this screen.`,
      });
      pushToast({ tone: "error", title: "Export failed to start", description: message });
    }
  }

  async function handleQueuePublish(platform: string) {
    if (!clip) return;
    try {
      setActionNotice(null);
      const job = await api.startClipPublishJob(clip.id, platform);
      setJobs((current) => upsertJob(current, job));
      setNavigateOnPublishCompletion(true);
      setActionNotice({
        tone: "info",
        title: "Publish queued",
        description: `The mock ${platform} adapter is now processing this exported clip in the background.`,
      });
      pushToast({ tone: "success", title: "Publish queued", description: `Mock ${platform} adapter accepted the request.` });
    } catch (error) {
      const message = (error as Error).message;
      setActionNotice({ tone: "error", title: "Queue publish failed", description: `${message} Export must exist before queueing a publish job.` });
      pushToast({ tone: "error", title: "Queue publish failed", description: message });
    }
  }

  function seekPreviewTo(time: number) {
    if (!sourcePreviewRef.current) return;
    sourcePreviewRef.current.currentTime = Math.max(0, time);
    void sourcePreviewRef.current.play().catch(() => undefined);
  }

  function nudgeBoundary(field: "start_time" | "end_time", delta: number) {
    setForm((current) => {
      const nextValue = Math.max(0, Number((current[field] + delta).toFixed(1)));
      return { ...current, [field]: nextValue };
    });
  }

  if (loading) return <LoadingState label="Loading clip review..." />;
  if (!clip || !project) {
    if (pageError) {
      return <ErrorState title="Clip review unavailable" description={pageError} actionLabel="Retry clip" onAction={() => void load()} />;
    }
    return <EmptyState title="Clip not found" description="This clip could not be loaded from the local API." />;
  }

  const preflightItems = [
    { label: "Clip approved", ready: clip.status === "approved" || clip.status === "exported" },
    { label: "Timing valid", ready: !validationError },
    { label: "Metadata filled", ready: Boolean(form.suggested_title.trim() && form.suggested_description.trim() && form.suggested_hashtags.trim()) },
    { label: "Export ready", ready: clip.status === "approved" || clip.status === "exported" },
    { label: "Publish ready", ready: Boolean(clip.latest_export?.output_url) && !activePublishJob },
  ];

  return (
    <div className="grid gap-8 xl:grid-cols-[0.85fr,1.15fr]">
      <section className="space-y-6">
        <div className="rounded-[36px] border border-white/10 bg-white/[0.04] p-5 shadow-panel">
          <div className="mx-auto max-w-sm">
            <div className="relative overflow-hidden rounded-[36px] border border-white/10 bg-black shadow-panel">
              <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 py-4">
                <span className="rounded-full bg-black/40 px-3 py-1 text-xs font-medium text-white">{formatDuration(clip.duration)}</span>
                <StatusBadge status={activeExportJob?.status ?? clip.status} />
              </div>
              <div className="aspect-[9/16] bg-black">
                {previewUrl ? (
                  <video
                    key={previewUrl}
                    controls
                    ref={sourcePreviewRef}
                    onLoadedMetadata={() => {
                      if (!clip.latest_export?.output_url && sourcePreviewRef.current) {
                        sourcePreviewRef.current.currentTime = Math.max(0, form.start_time);
                      }
                    }}
                    className="h-full w-full object-cover"
                    src={previewUrl}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-500">Preview unavailable</div>
                )}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => seekPreviewTo(form.start_time)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5"
              >
                <SkipBack className="h-4 w-4" />
                Jump to start
              </button>
              <button
                type="button"
                onClick={() => seekPreviewTo(Math.max(form.start_time, form.end_time - 1))}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5"
              >
                <SkipForward className="h-4 w-4" />
                Jump to end
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6">
          <h3 className="font-display text-xl font-semibold text-white">Quick Facts</h3>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-black/20 p-4">
              <p className="text-xs text-slate-500">Start</p>
              <p className="mt-2 font-semibold text-white">{form.start_time.toFixed(2)}s</p>
            </div>
            <div className="rounded-2xl bg-black/20 p-4">
              <p className="text-xs text-slate-500">End</p>
              <p className="mt-2 font-semibold text-white">{form.end_time.toFixed(2)}s</p>
            </div>
            <div className="rounded-2xl bg-black/20 p-4">
              <p className="text-xs text-slate-500">Subtitle Preset</p>
              <p className="mt-2 font-semibold capitalize text-white">{form.subtitle_preset}</p>
            </div>
            <div className="rounded-2xl bg-black/20 p-4">
              <p className="text-xs text-slate-500">Latest Export</p>
              <p className="mt-2 font-semibold text-white">{clip.latest_export?.status ?? "none"}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => nudgeBoundary("start_time", -0.5)}
              className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5"
            >
              Start -0.5s
            </button>
            <button
              type="button"
              onClick={() => nudgeBoundary("start_time", 0.5)}
              className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5"
            >
              Start +0.5s
            </button>
            <button
              type="button"
              onClick={() => nudgeBoundary("end_time", -0.5)}
              className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5"
            >
              End -0.5s
            </button>
            <button
              type="button"
              onClick={() => nudgeBoundary("end_time", 0.5)}
              className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5"
            >
              End +0.5s
            </button>
          </div>
          {clip.latest_export?.output_url ? (
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate("/exports")}
                className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5"
              >
                View exports
              </button>
              <a
                href={resolveMediaUrl(clip.latest_export.output_url)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/15"
              >
                <ExternalLink className="h-4 w-4" />
                Open exported video
              </a>
            </div>
          ) : null}
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-display text-xl font-semibold text-white">Export Preflight</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">Use this checklist before starting a background render or queueing a publish job.</p>
            </div>
            <Clock3 className="mt-1 h-5 w-5 text-slate-400" />
          </div>
          <div className="mt-5 space-y-3">
            {preflightItems.map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-2xl bg-black/20 px-4 py-3">
                <span className="text-sm text-white">{item.label}</span>
                <StatusBadge status={item.ready ? "completed" : "failed"} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-panel">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Review</p>
              <h3 className="mt-3 font-display text-3xl font-semibold text-white">{project.title}</h3>
              <p className="mt-2 text-sm text-slate-400">Fine-tune timing, metadata, and subtitle style before export.</p>
            </div>
            <StatusBadge status={clip.status} />
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">Start time</span>
              <input
                type="number"
                min={0}
                step="0.1"
                value={form.start_time}
                onChange={(event) => setForm((current) => ({ ...current, start_time: Number(event.target.value) }))}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-cyan-300/40"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">End time</span>
              <input
                type="number"
                min={0}
                step="0.1"
                value={form.end_time}
                onChange={(event) => setForm((current) => ({ ...current, end_time: Number(event.target.value) }))}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-cyan-300/40"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-slate-300">Title</span>
              <input
                value={form.suggested_title}
                onChange={(event) => setForm((current) => ({ ...current, suggested_title: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-cyan-300/40"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-slate-300">Description</span>
              <textarea
                rows={4}
                value={form.suggested_description}
                onChange={(event) => setForm((current) => ({ ...current, suggested_description: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-cyan-300/40"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-slate-300">Hashtags</span>
              <input
                value={form.suggested_hashtags}
                onChange={(event) => setForm((current) => ({ ...current, suggested_hashtags: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-cyan-300/40"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-slate-300">Subtitle preset</span>
              <select
                value={form.subtitle_preset}
                onChange={(event) => setForm((current) => ({ ...current, subtitle_preset: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-cyan-300/40"
              >
                {presets.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-slate-500">{presets.find((preset) => preset.value === form.subtitle_preset)?.note}</p>
            </label>
          </div>

          {validationError ? (
            <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{validationError}</div>
          ) : null}

          {actionNotice ? (
            <div
              className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
                actionNotice.tone === "error"
                  ? "border-rose-400/20 bg-rose-400/10 text-rose-100"
                  : actionNotice.tone === "success"
                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                    : "border-cyan-300/20 bg-cyan-300/10 text-cyan-100"
              }`}
            >
              <p className="font-semibold">{actionNotice.title}</p>
              <p className="mt-2 leading-6 text-white/85">{actionNotice.description}</p>
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || Boolean(validationError) || Boolean(activeExportJob)}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={saving || statusSubmitting !== null || Boolean(validationError) || Boolean(activeExportJob)}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm font-medium text-emerald-200 transition hover:bg-emerald-400/20"
            >
              <Check className="h-4 w-4" />
              {statusSubmitting === "approve" ? "Approving..." : "Approve"}
            </button>
            <button
              type="button"
              onClick={() => setRejectOpen(true)}
              disabled={saving || statusSubmitting !== null || Boolean(activeExportJob)}
              className="inline-flex items-center gap-2 rounded-2xl bg-rose-400/15 px-4 py-3 text-sm font-medium text-rose-200 transition hover:bg-rose-400/20"
            >
              <X className="h-4 w-4" />
              Reject
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={(clip.status !== "approved" && clip.status !== "exported") || Boolean(activeExportJob) || Boolean(validationError)}
              className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {activeExportJob ? `${activeExportJob.progress}% · Exporting` : "Export 1080x1920"}
            </button>
          </div>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="font-display text-xl font-semibold text-white">Mock Publish</h3>
              <p className="mt-2 text-sm text-slate-400">Queue the exported clip to a mock platform adapter. Real uploads are intentionally out of scope for v1.</p>
            </div>
            <StatusBadge status={clip.latest_export?.output_url ? "ready" : "not_connected"} />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            {["youtube", "instagram", "tiktok"].map((platform) => (
              <button
                key={platform}
                type="button"
                disabled={!clip.latest_export?.output_url || Boolean(activePublishJob)}
                onClick={() => handleQueuePublish(platform)}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {activePublishJob?.payload_json?.platform === platform ? `${activePublishJob.progress}% · Queueing` : `Queue ${platform}`}
              </button>
            ))}
          </div>
        </div>

        <WorkflowJobList
          jobs={relevantJobs}
          title="Clip Automation Activity"
          description="Export and publish runs continue in the background while you keep adjusting metadata and timing."
          emptyTitle="Export and publish runs for this clip will appear here."
        />
      </section>

      <ConfirmModal
        open={rejectOpen}
        title="Reject this clip?"
        description="This marks the clip as rejected in the review queue. You can still return and edit it later if priorities change."
        confirmLabel="Reject clip"
        onConfirm={handleReject}
        onClose={() => setRejectOpen(false)}
      />
    </div>
  );
}
