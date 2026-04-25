import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api } from "../api";
import { ClipCard } from "../components/ClipCard";
import { ConfirmModal } from "../components/ConfirmModal";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { FormatVariantCard } from "../components/FormatVariantCard";
import { LoadingState } from "../components/LoadingState";
import { ScriptIdeaCard } from "../components/ScriptIdeaCard";
import { useToast } from "../hooks/useToast";
import type { ClipCandidate, Project, ProjectCreativeStrategy } from "../types";
import { formatDuration, formatScore } from "../lib/formatters";

export function CandidateClipsPage() {
  const { projectId } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [clips, setClips] = useState<ClipCandidate[]>([]);
  const [creativeStrategy, setCreativeStrategy] = useState<ProjectCreativeStrategy | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [busyClipId, setBusyClipId] = useState<number | null>(null);
  const [pageError, setPageError] = useState("");
  const [actionNotice, setActionNotice] = useState<{ tone: "error" | "success" | "info"; title: string; description: string } | null>(null);
  const { pushToast } = useToast();

  async function load() {
    if (!projectId) return;
    try {
      setLoading(true);
      setPageError("");
      const [projectResponse, clipsResponse, strategyResponse] = await Promise.all([
        api.getProject(Number(projectId)),
        api.listProjectClips(Number(projectId)),
        api.getProjectCreativeStrategy(Number(projectId)),
      ]);
      setProject(projectResponse);
      setClips(clipsResponse);
      setCreativeStrategy(strategyResponse);
    } catch (error) {
      const message = (error as Error).message;
      setPageError(message);
      pushToast({ tone: "error", title: "클립 후보를 불러오지 못했습니다", description: message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [projectId]);

  async function handleApprove(clipId: number) {
    try {
      setBusyClipId(clipId);
      setActionNotice(null);
      const updated = await api.approveClip(clipId);
      setClips((current) => current.map((clip) => (clip.id === clipId ? updated : clip)));
      setActionNotice({
        tone: "success",
        title: "클립이 승인되었습니다",
        description: "이 후보는 이제 내보내기 가능 상태이며 다음 제작 단계로 넘어갈 수 있습니다.",
      });
      pushToast({ tone: "success", title: "클립이 승인되었습니다", description: "이 후보는 이제 내보내기 가능합니다." });
    } catch (error) {
      const message = (error as Error).message;
      setActionNotice({ tone: "error", title: "승인에 실패했습니다", description: `${message} 준비가 되면 다시 시도해 주세요.` });
      pushToast({ tone: "error", title: "승인에 실패했습니다", description: message });
    } finally {
      setBusyClipId(null);
    }
  }

  async function confirmReject() {
    if (rejectingId == null) return;
    try {
      setBusyClipId(rejectingId);
      setActionNotice(null);
      const updated = await api.rejectClip(rejectingId);
      setClips((current) => current.map((clip) => (clip.id === rejectingId ? updated : clip)));
      setActionNotice({
        tone: "info",
        title: "클립이 반려되었습니다",
        description: "기록 추적을 위해 목록에는 남아 있지만 더 이상 내보내기 가능 상태로 보이지 않습니다.",
      });
      pushToast({ tone: "info", title: "클립이 반려되었습니다", description: "기록 추적을 위해 목록에는 남아 있습니다." });
    } catch (error) {
      const message = (error as Error).message;
      setActionNotice({ tone: "error", title: "반려에 실패했습니다", description: `${message} 이미 내보낸 클립은 추적이 필요하므로 수정 후 다시 내보내야 합니다.` });
      pushToast({ tone: "error", title: "반려에 실패했습니다", description: message });
    } finally {
      setRejectingId(null);
      setBusyClipId(null);
    }
  }

  async function handleResetReview(clipId: number) {
    try {
      setBusyClipId(clipId);
      setActionNotice(null);
      const updated = await api.resetClipReview(clipId);
      setClips((current) => current.map((clip) => (clip.id === clipId ? updated : clip)));
      setActionNotice({
        tone: "info",
        title: "검토 상태를 되돌렸습니다",
        description: "이 후보를 다시 pending 상태로 돌려서 재검토하거나 수정 흐름으로 이어갈 수 있습니다.",
      });
      pushToast({ tone: "info", title: "검토 상태를 되돌렸습니다", description: "이 후보는 다시 검토 대기 상태가 되었습니다." });
    } catch (error) {
      const message = (error as Error).message;
      setActionNotice({ tone: "error", title: "되돌리기에 실패했습니다", description: `${message} 내보낸 클립은 새 버전으로 다시 내보내야 합니다.` });
      pushToast({ tone: "error", title: "되돌리기에 실패했습니다", description: message });
    } finally {
      setBusyClipId(null);
    }
  }

  if (loading) return <LoadingState label="클립 후보를 불러오는 중..." />;
  if (!project) {
    if (pageError) {
      return <ErrorState title="후보 큐를 사용할 수 없습니다" description={pageError} actionLabel="다시 시도" onAction={() => void load()} />;
    }
    return <EmptyState title="프로젝트를 찾을 수 없습니다" description="이 프로젝트를 찾지 못했습니다." />;
  }

  const rejectedOnly = clips.length > 0 && clips.every((clip) => clip.status === "rejected");
  const bestClip = [...clips].sort((left, right) => right.score - left.score)[0] ?? null;
  const averageScore = clips.length ? clips.reduce((sum, clip) => sum + clip.score, 0) / clips.length : 0;
  const sourceDuration = project.source_video?.duration_seconds ?? null;
  const formatSummary = clips.reduce<Record<string, number>>((summary, clip) => {
    const key = clip.recommended_format ?? "기본형";
    summary[key] = (summary[key] ?? 0) + 1;
    return summary;
  }, {});
  const categorySummary = clips.reduce<Record<string, number>>((summary, clip) => {
    const key = clip.content_profile_label ?? "일반";
    summary[key] = (summary[key] ?? 0) + 1;
    return summary;
  }, {});

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 rounded-[32px] border border-white/10 bg-white/[0.04] p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">검토 큐</p>
          <h3 className="mt-3 font-display text-3xl font-semibold text-white">{project.title}</h3>
          <p className="mt-2 text-sm text-slate-400">
            후보 {clips.length}개 · 대기 {clips.filter((clip) => clip.status === "pending").length}개 ·{" "}
            승인/내보내기 {clips.filter((clip) => clip.status === "approved" || clip.status === "exported").length}개
          </p>
          {sourceDuration ? (
            <p className="mt-3 text-sm leading-6 text-slate-300">
              원본 {formatDuration(sourceDuration)}를 분석해 상위 {clips.length || 5}개 후보를 우선 검토용으로 정렬했습니다. 긴 영상일수록 초반 훅, 완결감,
              타임라인 분산을 같이 보며 추천합니다.
            </p>
          ) : null}
          {rejectedOnly ? (
            <p className="mt-3 text-sm leading-6 text-amber-100/85">
              현재 후보가 모두 반려되었습니다. 자막을 다시 생성하거나 후보 생성을 새로 실행해 새 검토 큐를 만드는 편이 좋습니다.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to={`/projects/${project.id}`}
            className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/5"
          >
            프로젝트로 돌아가기
          </Link>
        </div>
      </section>

      {clips.length ? (
        <section className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
          <div className="rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.08] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/75">자동 숏츠 분석 결과</p>
            <p className="mt-3 text-lg font-semibold text-white">
              {bestClip ? `가장 강한 후보는 점수 ${formatScore(bestClip.score)} · ${bestClip.recommended_format ?? "기본 포맷"}` : "분석 결과를 불러오는 중"}
            </p>
            <p className="mt-2 text-sm leading-6 text-cyan-50/85">
              현재 후보들은 조회수 가능성, 초반 훅, 길이 완결감, 그리고 경기 분석형 해설 포맷까지 함께 반영해 추천 순으로 정렬되어 있습니다.
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">추천 요약</p>
              <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-slate-200">평균 점수 {formatScore(averageScore)}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(formatSummary).map(([label, count]) => (
                <span key={label} className="rounded-full bg-white/6 px-3 py-1.5 text-xs font-medium text-slate-200">
                  {label} {count}개
                </span>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(categorySummary).map(([label, count]) => (
                <span key={label} className="rounded-full bg-cyan-300/10 px-3 py-1.5 text-xs font-medium text-cyan-100">
                  {label} {count}개
                </span>
              ))}
            </div>
            {bestClip?.selection_reason ? (
              <p className="mt-4 text-sm leading-6 text-slate-300">{bestClip.selection_reason}</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {creativeStrategy && clips.length ? (
        <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-panel">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">전략 포커스</p>
          <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr,0.95fr]">
            <div className="rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.08] p-5">
              <p className="text-sm leading-7 text-cyan-50/90">{creativeStrategy.strategy_focus}</p>
            </div>
            <div className="rounded-3xl border border-white/8 bg-black/20 p-5">
              <p className="text-sm leading-7 text-slate-200">
                이 프로젝트는 한 후보만 바로 내보내는 흐름보다, 같은 원본으로 <span className="font-semibold text-white">빅 헤드라인형</span>,{" "}
                <span className="font-semibold text-white">반응 밈형</span>, <span className="font-semibold text-white">카운트다운형</span>처럼 여러 숏폼
                형태를 같이 비교하는 편이 더 좋습니다.
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-400">
                아래 카드에서 포맷과 스크립트를 먼저 고르고, 마음에 드는 후보로 들어가 제목/설명/자막을 바로 수정하면 됩니다.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {actionNotice ? (
        <section
          className={`rounded-3xl border px-5 py-4 text-sm ${
            actionNotice.tone === "error"
              ? "border-rose-400/20 bg-rose-400/10 text-rose-100"
              : actionNotice.tone === "success"
                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                : "border-cyan-300/20 bg-cyan-300/10 text-cyan-100"
          }`}
        >
          <p className="font-semibold">{actionNotice.title}</p>
          <p className="mt-2 leading-6 text-white/85">{actionNotice.description}</p>
        </section>
      ) : null}

      {rejectedOnly ? (
        <section className="rounded-3xl border border-amber-300/20 bg-amber-300/10 px-5 py-4 text-sm text-amber-50">
          <p className="font-semibold">검토 가능한 후보가 현재 없습니다</p>
          <p className="mt-2 leading-6 text-white/85">
            반려된 후보는 기록용으로 남아 있지만 지금은 승인하거나 내보낼 수 없습니다. 프로젝트 상세로 돌아가 자막이나 후보 생성을 다시 실행해 보세요.
          </p>
          <div className="mt-4">
            <Link
              to={`/projects/${project.id}`}
              className="inline-flex rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/15"
            >
              프로젝트 상세로 이동
            </Link>
          </div>
        </section>
      ) : null}

      {creativeStrategy?.format_variants.length ? (
        <section className="space-y-4" id="formats">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">숏폼 형태 제안</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">같은 원본으로 이렇게 나눠볼 수 있습니다</h3>
            </div>
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            {creativeStrategy.format_variants.map((variant) => (
              <FormatVariantCard key={`${variant.id}-${variant.source_clip_id}`} variant={variant} />
            ))}
          </div>
        </section>
      ) : null}

      {creativeStrategy?.script_ideas.length ? (
        <section className="space-y-4" id="scripts">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">스크립트 아이디어</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">제목만 바꾸는 게 아니라 말할 흐름까지 같이 잡습니다</h3>
            </div>
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            {creativeStrategy.script_ideas.map((idea) => (
              <ScriptIdeaCard key={idea.id} idea={idea} />
            ))}
          </div>
        </section>
      ) : null}

      {clips.length ? (
        <section className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
          {clips.map((clip) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              onApprove={busyClipId ? undefined : handleApprove}
              onReject={busyClipId ? undefined : (clipId) => setRejectingId(clipId)}
              onResetReview={busyClipId ? undefined : handleResetReview}
            />
          ))}
        </section>
      ) : (
        <EmptyState
          title="아직 후보가 없습니다"
          description="자막 추출이 끝난 뒤 프로젝트 상세에서 클립 후보를 생성해 주세요."
          actionLabel="프로젝트 열기"
          actionHref={`/projects/${project.id}`}
        />
      )}

      <ConfirmModal
        open={rejectingId != null}
        title="이 클립 후보를 반려할까요?"
        description="리뷰 로그에는 남겨두되 반려 상태로 표시하여 내보내기 준비 완료처럼 보이지 않게 합니다."
        confirmLabel="클립 반려"
        onConfirm={confirmReject}
        onClose={() => setRejectingId(null)}
      />
    </div>
  );
}
