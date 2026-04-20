import { Check, Download, ExternalLink, Save, Send, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { api } from "../api";
import { ConfirmModal } from "../components/ConfirmModal";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../hooks/useToast";
import { formatDuration } from "../lib/formatters";
import { resolveMediaUrl } from "../lib/media";
import type { ClipCandidate, Project } from "../types";

const presets = [
  { value: "clean", label: "Clean", note: "Balanced sizing and subtle outline." },
  { value: "bold", label: "Bold", note: "Higher contrast and stronger emphasis." },
  { value: "creator", label: "Creator", note: "Heavier treatment for social-first energy." },
];

export function ClipReviewPage() {
  const { clipId } = useParams();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const [clip, setClip] = useState<ClipCandidate | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [queueingPlatform, setQueueingPlatform] = useState<string | null>(null);
  const [statusSubmitting, setStatusSubmitting] = useState<"approve" | "reject" | null>(null);
  const [pageError, setPageError] = useState("");
  const [actionNotice, setActionNotice] = useState<{ tone: "error" | "info" | "success"; title: string; description: string } | null>(
    null,
  );
  const sourcePreviewRef = useRef<HTMLVideoElement | null>(null);
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
    if (form.end_time <= form.start_time) return "End time must be greater than start time.";
    if (form.end_time - form.start_time < 8) return "Clip duration should remain long enough to make sense on review.";
    if (form.end_time - form.start_time > 45) return "Keep the review clip at 45 seconds or less so it remains export-ready.";
    return "";
  }, [form.end_time, form.start_time]);

  async function load() {
    if (!clipId) return;
    try {
      setLoading(true);
      setPageError("");
      const clipResponse = await api.getClip(Number(clipId));
      setClip(clipResponse);
      const projectResponse = await api.getProject(clipResponse.project_id);
      setProject(projectResponse);
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
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [clipId]);

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
      setExporting(true);
      setActionNotice(null);
      const exportRecord = await api.exportClip(clip.id);
      const refreshed = await api.getClip(clip.id);
      setClip(refreshed);
      setActionNotice({
        tone: "success",
        title: "Export completed",
        description: exportRecord.output_path ?? "The vertical MP4 is ready. You can open it here or jump to the exports page.",
      });
      pushToast({
        tone: "success",
        title: "Export completed",
        description: exportRecord.output_path ?? "The vertical MP4 is ready and visible on the exports page.",
      });
    } catch (error) {
      const message = (error as Error).message;
      setActionNotice({
        tone: "error",
        title: "Export failed",
        description: `${message} Check FFmpeg, local disk space, and clip timing, then retry export from this screen.`,
      });
      pushToast({ tone: "error", title: "Export failed", description: message });
    } finally {
      setExporting(false);
    }
  }

  async function handleQueuePublish(platform: string) {
    if (!clip) return;
    try {
      setQueueingPlatform(platform);
      setActionNotice(null);
      await api.queuePublish(clip.id, platform);
      setActionNotice({
        tone: "success",
        title: "Publish queued",
        description: `The mock ${platform} adapter accepted this exported clip.`,
      });
      pushToast({ tone: "success", title: "Publish job queued", description: `Mock ${platform} adapter accepted the clip.` });
      navigate("/publish");
    } catch (error) {
      const message = (error as Error).message;
      setActionNotice({ tone: "error", title: "Queue publish failed", description: `${message} Export must exist before queueing a publish job.` });
      pushToast({ tone: "error", title: "Queue publish failed", description: message });
    } finally {
      setQueueingPlatform(null);
    }
  }

  if (loading) return <LoadingState label="Loading clip review..." />;
  if (!clip || !project) {
    if (pageError) {
      return <ErrorState title="Clip review unavailable" description={pageError} actionLabel="Retry clip" onAction={() => void load()} />;
    }
    return <EmptyState title="Clip not found" description="This clip could not be loaded from the local API." />;
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[0.85fr,1.15fr]">
      <section className="space-y-6">
        <div className="rounded-[36px] border border-white/10 bg-white/[0.04] p-5 shadow-panel">
          <div className="mx-auto max-w-sm">
            <div className="relative overflow-hidden rounded-[36px] border border-white/10 bg-black shadow-panel">
              <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 py-4">
                <span className="rounded-full bg-black/40 px-3 py-1 text-xs font-medium text-white">{formatDuration(clip.duration)}</span>
                <StatusBadge status={clip.status} />
              </div>
              <div className="aspect-[9/16] bg-black">
                {previewUrl ? (
                  <video
                    key={previewUrl}
                    controls
                    ref={sourcePreviewRef}
                    onLoadedMetadata={() => {
                      if (!clip.latest_export?.output_url && sourcePreviewRef.current) {
                        sourcePreviewRef.current.currentTime = Math.max(0, clip.start_time);
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
          </div>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6">
          <h3 className="font-display text-xl font-semibold text-white">Quick Facts</h3>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-black/20 p-4">
              <p className="text-xs text-slate-500">Start</p>
              <p className="mt-2 font-semibold text-white">{clip.start_time.toFixed(2)}s</p>
            </div>
            <div className="rounded-2xl bg-black/20 p-4">
              <p className="text-xs text-slate-500">End</p>
              <p className="mt-2 font-semibold text-white">{clip.end_time.toFixed(2)}s</p>
            </div>
            <div className="rounded-2xl bg-black/20 p-4">
              <p className="text-xs text-slate-500">Subtitle Preset</p>
              <p className="mt-2 font-semibold capitalize text-white">{clip.subtitle_preset}</p>
            </div>
            <div className="rounded-2xl bg-black/20 p-4">
              <p className="text-xs text-slate-500">Latest Export</p>
              <p className="mt-2 font-semibold text-white">{clip.latest_export?.status ?? "none"}</p>
            </div>
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
              disabled={saving || Boolean(validationError)}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={saving || exporting || statusSubmitting !== null}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm font-medium text-emerald-200 transition hover:bg-emerald-400/20"
            >
              <Check className="h-4 w-4" />
              {statusSubmitting === "approve" ? "Approving..." : "Approve"}
            </button>
            <button
              type="button"
              onClick={() => setRejectOpen(true)}
              disabled={saving || exporting || statusSubmitting !== null}
              className="inline-flex items-center gap-2 rounded-2xl bg-rose-400/15 px-4 py-3 text-sm font-medium text-rose-200 transition hover:bg-rose-400/20"
            >
              <X className="h-4 w-4" />
              Reject
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={(clip.status !== "approved" && clip.status !== "exported") || exporting || Boolean(validationError)}
              className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {exporting ? "Exporting..." : "Export 1080x1920"}
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
                disabled={!clip.latest_export?.output_url || queueingPlatform !== null}
                onClick={() => handleQueuePublish(platform)}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {queueingPlatform === platform ? "Queueing..." : `Queue ${platform}`}
              </button>
            ))}
          </div>
        </div>
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
