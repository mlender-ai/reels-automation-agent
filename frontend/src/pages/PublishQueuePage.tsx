import { useEffect, useMemo, useState } from "react";

import { api } from "../api";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
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
  const [pageError, setPageError] = useState("");
  const { pushToast } = useToast();

  async function load() {
    try {
      setPageError("");
      const [queueResponse, clipsResponse] = await Promise.all([api.listPublishJobs(), api.listClips(["approved", "exported"])]);
      const exportedClips = clipsResponse.filter((clip) => Boolean(clip.latest_export?.output_url));
      setQueue(queueResponse);
      setEligibleClips(exportedClips);
      setSelectedClipId((current) => current ?? exportedClips[0]?.id ?? null);
    } catch (error) {
      const message = (error as Error).message;
      setPageError(message);
      pushToast({ tone: "error", title: "게시 큐를 불러오지 못했습니다", description: message });
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
      pushToast({ tone: "error", title: "클립이 선택되지 않았습니다", description: "게시 큐에 넣기 전에 내보낸 클립을 선택해 주세요." });
      return;
    }
    try {
      setSubmitting(true);
      await api.queuePublish(selectedClipId, platform);
      await load();
      pushToast({ tone: "success", title: "게시 큐에 등록되었습니다", description: `모의 ${platform} 어댑터가 선택한 클립을 받았습니다.` });
    } catch (error) {
      pushToast({ tone: "error", title: "게시 큐 등록에 실패했습니다", description: (error as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingState label="게시 큐를 불러오는 중..." />;
  if (!queue) {
    if (pageError) {
      return <ErrorState title="게시 큐를 사용할 수 없습니다" description={pageError} actionLabel="다시 시도" onAction={() => void load()} />;
    }
    return <EmptyState title="게시 큐를 사용할 수 없습니다" description="큐 엔드포인트에서 데이터를 반환하지 않았습니다." />;
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 xl:grid-cols-3">
        {queue.platforms.map((platformStatus) => (
          <PublishPlatformChip key={platformStatus.platform} platform={platformStatus} />
        ))}
      </section>

      <section className="grid gap-8 xl:grid-cols-[0.95fr,1.05fr]">
        <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-panel">
          <h3 className="font-display text-2xl font-semibold text-white">새 게시 작업 등록</h3>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            완료된 export가 있는 클립만 선택할 수 있습니다. 이렇게 해야 나중에 실제 플랫폼 업로드 어댑터를 붙여도 구조가 유지됩니다.
          </p>

          {eligibleClips.length ? (
            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">내보낸 클립</span>
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
                <span className="mb-2 block text-sm font-medium text-slate-300">플랫폼</span>
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
              아직 내보낸 클립이 없습니다. 클립을 승인하고 export를 실행한 뒤 이 화면으로 돌아와 게시 작업을 등록해 주세요.
            </div>
          )}

          <button
            type="button"
            onClick={handleQueue}
            disabled={!eligibleClips.length || submitting}
            className="mt-6 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "등록 중..." : "게시 작업 등록"}
          </button>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-panel">
          <div className="flex items-center justify-between gap-4">
            <h3 className="font-display text-2xl font-semibold text-white">작업 현황</h3>
            <span className="text-sm text-slate-400">{queue.items.length}건 추적 중</span>
          </div>
          {queue.items.length ? (
            <div className="mt-6 space-y-3">
              {queue.items.map((job) => (
                <div key={job.id} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{job.clip_title ?? `Clip #${job.clip_candidate_id}`}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">{job.platform}</p>
                      <p className="mt-3 text-xs text-slate-500">등록 {formatDateTime(job.created_at)}</p>
                    </div>
                    <StatusBadge status={job.status} />
                  </div>
                  {job.result_json ? (
                    <div className="mt-3 rounded-2xl bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
                      {job.status === "posted"
                        ? `원격 ID: ${String(job.result_json.remote_id ?? "mock-posted")}`
                        : job.status === "failed"
                          ? `실패 사유: ${String(job.result_json.error ?? "mock publish failure")}`
                          : "모의 어댑터 완료를 기다리는 중"}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="아직 게시 작업이 없습니다" description="클립을 내보낸 뒤 이 화면에서 등록하면 플랫폼 전달 흐름을 모의로 확인할 수 있습니다." />
          )}
        </div>
      </section>
    </div>
  );
}
