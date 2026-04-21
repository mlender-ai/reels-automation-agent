import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api } from "../api";
import { ClipCard } from "../components/ClipCard";
import { ConfirmModal } from "../components/ConfirmModal";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { useToast } from "../hooks/useToast";
import type { ClipCandidate, Project } from "../types";

export function CandidateClipsPage() {
  const { projectId } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [clips, setClips] = useState<ClipCandidate[]>([]);
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
      const [projectResponse, clipsResponse] = await Promise.all([api.getProject(Number(projectId)), api.listProjectClips(Number(projectId))]);
      setProject(projectResponse);
      setClips(clipsResponse);
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

  if (loading) return <LoadingState label="클립 후보를 불러오는 중..." />;
  if (!project) {
    if (pageError) {
      return <ErrorState title="후보 큐를 사용할 수 없습니다" description={pageError} actionLabel="다시 시도" onAction={() => void load()} />;
    }
    return <EmptyState title="프로젝트를 찾을 수 없습니다" description="이 프로젝트를 찾지 못했습니다." />;
  }

  const rejectedOnly = clips.length > 0 && clips.every((clip) => clip.status === "rejected");

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

      {clips.length ? (
        <section className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
          {clips.map((clip) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              onApprove={busyClipId ? undefined : handleApprove}
              onReject={busyClipId ? undefined : (clipId) => setRejectingId(clipId)}
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
