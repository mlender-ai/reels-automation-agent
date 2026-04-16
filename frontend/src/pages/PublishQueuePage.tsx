import { useEffect, useMemo, useState } from "react";

import { api } from "../api";
import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { PublishPlatformChip } from "../components/PublishPlatformChip";
import { StatusBadge } from "../components/StatusBadge";
import { useInterval } from "../hooks/useInterval";
import { useToast } from "../hooks/useToast";
import { formatDateTime } from "../lib/formatters";
import type { ClipCandidate, PublishQueueResponse } from "../types";

export function PublishQueuePage() {
  const [queue, setQueue] = useState<PublishQueueResponse | null>(null);
  const [eligibleClips, setEligibleClips] = useState<ClipCandidate[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<number | null>(null);
  const [platform, setPlatform] = useState("youtube");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const { pushToast } = useToast();

  async function load() {
    try {
      const [queueResponse, clipsResponse] = await Promise.all([api.listPublishJobs(), api.listClips(["approved", "exported"])]);
      const exportedClips = clipsResponse.filter((clip) => Boolean(clip.latest_export?.output_url));
      setQueue(queueResponse);
      setEligibleClips(exportedClips);
      setSelectedClipId((current) => current ?? exportedClips[0]?.id ?? null);
    } catch (error) {
      pushToast({ tone: "error", title: "Publish queue failed to load", description: (error as Error).message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const hasQueuedJobs = useMemo(() => Boolean(queue?.items.some((item) => item.status === "queued")), [queue?.items]);

  useInterval(() => {
    void load();
  }, hasQueuedJobs ? 4000 : null);

  async function handleQueue() {
    if (!selectedClipId) {
      pushToast({ tone: "error", title: "No clip selected", description: "Choose an exported clip before queueing publish." });
      return;
    }
    try {
      setSubmitting(true);
      await api.queuePublish(selectedClipId, platform);
      await load();
      pushToast({ tone: "success", title: "Publish queued", description: `Mock ${platform} adapter accepted the selected clip.` });
    } catch (error) {
      pushToast({ tone: "error", title: "Queue publish failed", description: (error as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingState label="Loading publish queue..." />;
  if (!queue) return <EmptyState title="Publish queue unavailable" description="The queue endpoint did not return data." />;

  return (
    <div className="space-y-8">
      <section className="grid gap-4 xl:grid-cols-3">
        {queue.platforms.map((platformStatus) => (
          <PublishPlatformChip key={platformStatus.platform} platform={platformStatus} />
        ))}
      </section>

      <section className="grid gap-8 xl:grid-cols-[0.95fr,1.05fr]">
        <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-panel">
          <h3 className="font-display text-2xl font-semibold text-white">Queue New Publish Job</h3>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Only clips with a completed export are eligible. This keeps the adapter contract ready for future real platform uploads.
          </p>

          {eligibleClips.length ? (
            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">Exported clip</span>
                <select
                  value={selectedClipId ?? ""}
                  onChange={(event) => setSelectedClipId(Number(event.target.value))}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-cyan-300/40"
                >
                  {eligibleClips.map((clip) => (
                    <option key={clip.id} value={clip.id}>
                      #{clip.id} · {clip.suggested_title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">Platform</span>
                <select
                  value={platform}
                  onChange={(event) => setPlatform(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-cyan-300/40"
                >
                  <option value="youtube">YouTube Shorts</option>
                  <option value="instagram">Instagram Reels</option>
                  <option value="tiktok">TikTok</option>
                </select>
              </label>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-4 text-sm leading-6 text-slate-400">
              No exported clips are ready yet. Approve a clip, run export, then come back here to queue the mock publish job.
            </div>
          )}

          <button
            type="button"
            onClick={handleQueue}
            disabled={!eligibleClips.length || submitting}
            className="mt-6 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Queueing..." : "Queue Publish Job"}
          </button>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-panel">
          <div className="flex items-center justify-between gap-4">
            <h3 className="font-display text-2xl font-semibold text-white">Job Activity</h3>
            <span className="text-sm text-slate-400">{queue.items.length} jobs tracked</span>
          </div>
          {queue.items.length ? (
            <div className="mt-6 space-y-3">
              {queue.items.map((job) => (
                <div key={job.id} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{job.clip_title ?? `Clip #${job.clip_candidate_id}`}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">{job.platform}</p>
                      <p className="mt-3 text-xs text-slate-500">Queued {formatDateTime(job.created_at)}</p>
                    </div>
                    <StatusBadge status={job.status} />
                  </div>
                  {job.result_json ? (
                    <div className="mt-3 rounded-2xl bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
                      {job.status === "posted"
                        ? `Remote id: ${String(job.result_json.remote_id ?? "mock-posted")}`
                        : job.status === "failed"
                          ? `Failure: ${String(job.result_json.error ?? "mock publish failure")}`
                          : "Waiting for mock adapter completion"}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No publish jobs yet" description="Export a clip and queue it here to simulate downstream platform delivery." />
          )}
        </div>
      </section>
    </div>
  );
}
