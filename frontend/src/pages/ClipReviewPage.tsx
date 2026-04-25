import { Check, Download, ExternalLink, RotateCcw, Save, Send, SkipBack, SkipForward, X } from "lucide-react";
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
  const [statusSubmitting, setStatusSubmitting] = useState<"approve" | "reject" | "reset" | null>(null);
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
  const latestFailedExportJob = useMemo(
    () => relevantJobs.find((job) => job.job_type === "export" && job.status === "failed") ?? null,
    [relevantJobs],
  );
  const latestFailedPublishJob = useMemo(
    () => relevantJobs.find((job) => job.job_type === "publish" && job.status === "failed") ?? null,
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
      pushToast({ tone: "error", title: "클립 리뷰 화면을 불러오지 못했습니다", description: message });
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
            ? "1080x1920 MP4 결과물이 준비되었습니다. 내보내기 화면에서 바로 확인할 수 있습니다."
            : "모의 플랫폼 어댑터가 클립을 받아 게시 작업을 저장했습니다.";
        setActionNotice({ tone: "success", title: `${workflowJobTypeLabel(job.job_type)} 완료`, description });
        pushToast({ tone: "success", title: `${workflowJobTypeLabel(job.job_type)} 완료`, description });
        if (job.job_type === "export" && navigateOnExportCompletion) {
          setNavigateOnExportCompletion(false);
          navigate("/exports");
        }
        if (job.job_type === "publish" && navigateOnPublishCompletion) {
          setNavigateOnPublishCompletion(false);
          navigate("/publish");
        }
      } else if (job.status === "failed") {
        const description = job.error_detail ?? "로컬 런타임 도구와 내보내기 조건을 확인한 뒤 다시 시도해 주세요.";
        setActionNotice({ tone: "error", title: `${workflowJobTypeLabel(job.job_type)} 실패`, description });
        pushToast({ tone: "error", title: `${workflowJobTypeLabel(job.job_type)} 실패`, description });
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
        title: "저장되었습니다",
        description: "타이밍과 메타데이터가 다음 내보내기에 맞춰 반영되었습니다.",
      });
      pushToast({ tone: "success", title: "클립을 저장했습니다", description: "타이밍과 메타데이터를 업데이트했습니다." });
    } catch (error) {
      const message = (error as Error).message;
      setActionNotice({ tone: "error", title: "저장에 실패했습니다", description: `${message} 타이밍을 조정한 뒤 다시 시도해 주세요.` });
      pushToast({ tone: "error", title: "저장에 실패했습니다", description: message });
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
      setActionNotice({ tone: "success", title: "승인되었습니다", description: "이제 이 클립을 세로형 결과물로 내보낼 수 있습니다." });
      pushToast({ tone: "success", title: "클립을 승인했습니다", description: "이 후보는 이제 내보내기를 진행할 수 있습니다." });
    } catch (error) {
      const message = (error as Error).message;
      setActionNotice({ tone: "error", title: "승인에 실패했습니다", description: `${message} 로컬 API 연결을 확인한 뒤 다시 시도해 주세요.` });
      pushToast({ tone: "error", title: "승인에 실패했습니다", description: message });
    } finally {
      setStatusSubmitting(null);
    }
  }

  async function handleReject() {
    if (!clip) return;
    try {
      setStatusSubmitting("reset");
      setActionNotice(null);
      const updated = await api.rejectClip(clip.id);
      setClip(updated);
      setRejectOpen(false);
      setActionNotice({ tone: "info", title: "반려되었습니다", description: "클립은 계속 수정할 수 있지만, 현재는 내보내기 준비 상태에서 제외됩니다." });
      pushToast({ tone: "info", title: "클립을 반려했습니다", description: "우선순위가 바뀌면 나중에 다시 열어 수정할 수 있습니다." });
    } catch (error) {
      const message = (error as Error).message;
      setActionNotice({ tone: "error", title: "반려에 실패했습니다", description: `${message} 여전히 준비 큐에서 제외하려면 다시 시도해 주세요.` });
      pushToast({ tone: "error", title: "반려에 실패했습니다", description: message });
    } finally {
      setStatusSubmitting(null);
    }
  }

  async function handleResetReview() {
    if (!clip) return;
    try {
      setStatusSubmitting("reject");
      setActionNotice(null);
      const updated = await api.resetClipReview(clip.id);
      setClip(updated);
      setActionNotice({
        tone: "info",
        title: "검토 상태를 되돌렸습니다",
        description: "이제 다시 pending 상태에서 수정하거나 승인 여부를 재검토할 수 있습니다.",
      });
      pushToast({ tone: "info", title: "검토 상태를 되돌렸습니다", description: "이 클립은 다시 검토 대기 상태가 되었습니다." });
    } catch (error) {
      const message = (error as Error).message;
      setActionNotice({ tone: "error", title: "되돌리기에 실패했습니다", description: `${message} 이미 내보낸 결과물이 있으면 새 버전을 다시 만들어야 합니다.` });
      pushToast({ tone: "error", title: "되돌리기에 실패했습니다", description: message });
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
        title: "내보내기를 대기열에 등록했습니다",
        description: "세로형 렌더링이 백그라운드에서 실행됩니다. 결과물이 내보내기 목록에 나타날 때까지 이 화면이 진행률을 계속 확인합니다.",
      });
      pushToast({ tone: "success", title: "내보내기를 시작했습니다", description: "백그라운드 내보내기 작업이 시작되었습니다." });
    } catch (error) {
      const message = (error as Error).message;
      setActionNotice({
        tone: "error",
        title: "내보내기를 시작하지 못했습니다",
        description: `${message} FFmpeg, 로컬 디스크 공간, 클립 타이밍을 확인한 뒤 이 화면에서 다시 시도해 주세요.`,
      });
      pushToast({ tone: "error", title: "내보내기를 시작하지 못했습니다", description: message });
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
        title: "게시 큐에 등록했습니다",
        description: `모의 ${platform} 어댑터가 이 결과물을 백그라운드에서 처리하고 있습니다.`,
      });
      pushToast({ tone: "success", title: "게시 큐에 등록했습니다", description: `모의 ${platform} 어댑터가 요청을 받았습니다.` });
    } catch (error) {
      const message = (error as Error).message;
      setActionNotice({ tone: "error", title: "게시 큐 등록에 실패했습니다", description: `${message} 게시 작업을 등록하려면 먼저 결과물이 있어야 합니다.` });
      pushToast({ tone: "error", title: "게시 큐 등록에 실패했습니다", description: message });
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

  if (loading) return <LoadingState label="클립 리뷰 화면을 불러오는 중..." />;
  if (!clip || !project) {
    if (pageError) {
      return <ErrorState title="클립 리뷰 화면을 불러올 수 없습니다" description={pageError} actionLabel="다시 시도" onAction={() => void load()} />;
    }
    return <EmptyState title="클립을 찾을 수 없습니다" description="로컬 API에서 이 클립을 불러오지 못했습니다." />;
  }

  const metaCompleted = Boolean(form.suggested_title.trim() && form.suggested_description.trim() && form.suggested_hashtags.trim());
  const canExport = (clip.status === "approved" || clip.status === "exported") && !validationError;
  const canPublish = Boolean(clip.latest_export?.output_url) && !activePublishJob;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-[34px] border border-white/10 bg-white/[0.04] p-4 shadow-panel lg:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">바로 확인</p>
              <h3 className="mt-2 font-display text-2xl font-semibold text-white lg:text-3xl">
                {form.suggested_title || clip.analysis_headline || project.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {formatDuration(clip.duration)} · {form.start_time.toFixed(1)}초부터 {form.end_time.toFixed(1)}초까지
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={clip.status} />
              {activeExportJob ? <StatusBadge status={activeExportJob.status} /> : null}
            </div>
          </div>

          {actionNotice ? (
            <div
              className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                actionNotice.tone === "error"
                  ? "border-rose-400/20 bg-rose-400/10 text-rose-100"
                  : actionNotice.tone === "success"
                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                    : "border-cyan-300/20 bg-cyan-300/10 text-cyan-100"
              }`}
            >
              <p className="font-semibold">{actionNotice.title}</p>
              <p className="mt-1 leading-6 text-white/85">{actionNotice.description}</p>
            </div>
          ) : null}

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_200px]">
            <div className="rounded-[30px] border border-white/10 bg-black/35 p-4">
              <div className="flex flex-col justify-between">
                <div className="flex flex-1 items-center justify-center">
                  <div className="w-full max-w-[320px]">
                    <div className="relative overflow-hidden rounded-[36px] border border-white/10 bg-black shadow-panel">
                      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 py-4">
                        <span className="rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white">{formatDuration(clip.duration)}</span>
                        <span className="rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white">9:16</span>
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
                          <div className="flex h-full items-center justify-center text-slate-500">미리보기를 사용할 수 없습니다</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => seekPreviewTo(form.start_time)}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.06]"
                  >
                    <SkipBack className="h-4 w-4" />
                    시작 지점 보기
                  </button>
                  <button
                    type="button"
                    onClick={() => seekPreviewTo(Math.max(form.start_time, form.end_time - 1))}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.06]"
                  >
                    <SkipForward className="h-4 w-4" />
                    끝 지점 보기
                  </button>
                </div>
              </div>
            </div>

            <div className="grid content-start gap-3">
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">이번 버전</p>
                <p className="mt-2 text-lg font-semibold text-white">{clip.analysis_headline ?? "오프닝 훅 준비 중"}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">상단 훅 한 줄만 짧게 노출됩니다. 보조 배너와 서브타이틀은 넣지 않습니다.</p>
              </div>
              <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">포맷</p>
                  <p className="mt-2 font-semibold text-white">{clip.recommended_format ?? "기본 포맷"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">점수</p>
                  <p className="mt-2 font-semibold text-white">{clip.score.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">상태</p>
                  <div className="mt-2">
                    <StatusBadge status={clip.status} />
                  </div>
                </div>
              </div>
              {clip.latest_export?.output_url ? (
                <div className="grid gap-2">
                  <a
                    href={resolveMediaUrl(clip.latest_export.output_url)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                  >
                    <ExternalLink className="h-4 w-4" />
                    결과 영상 열기
                  </a>
                  <button
                    type="button"
                    onClick={() => navigate("/exports")}
                    className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5"
                  >
                    내보내기 목록 보기
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <aside className="xl:sticky xl:top-[92px]">
          <div className="max-h-[calc(100vh-7rem)] space-y-4 overflow-y-auto rounded-[34px] border border-white/10 bg-white/[0.04] p-5 shadow-panel">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">작업 패널</p>
                <h3 className="mt-2 font-display text-xl font-semibold text-white">{project.title}</h3>
              </div>
              <StatusBadge status={clip.status} />
            </div>

            <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-black/25 p-3">
                  <p className="text-xs text-slate-500">시작</p>
                  <p className="mt-2 font-semibold text-white">{form.start_time.toFixed(1)}s</p>
                </div>
                <div className="rounded-2xl bg-black/25 p-3">
                  <p className="text-xs text-slate-500">종료</p>
                  <p className="mt-2 font-semibold text-white">{form.end_time.toFixed(1)}s</p>
                </div>
                <div className="rounded-2xl bg-black/25 p-3">
                  <p className="text-xs text-slate-500">메타데이터</p>
                  <p className="mt-2 font-semibold text-white">{metaCompleted ? "입력됨" : "미완료"}</p>
                </div>
                <div className="rounded-2xl bg-black/25 p-3">
                  <p className="text-xs text-slate-500">게시 가능</p>
                  <p className="mt-2 font-semibold text-white">{clip.latest_export?.output_url ? "가능" : "먼저 export"}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-300">시작 시간</span>
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
                  <span className="mb-2 block text-sm font-medium text-slate-300">종료 시간</span>
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={form.end_time}
                    onChange={(event) => setForm((current) => ({ ...current, end_time: Number(event.target.value) }))}
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-cyan-300/40"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => nudgeBoundary("start_time", -0.5)}
                  className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5"
                >
                  시작 -0.5초
                </button>
                <button
                  type="button"
                  onClick={() => nudgeBoundary("start_time", 0.5)}
                  className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5"
                >
                  시작 +0.5초
                </button>
                <button
                  type="button"
                  onClick={() => nudgeBoundary("end_time", -0.5)}
                  className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5"
                >
                  종료 -0.5초
                </button>
                <button
                  type="button"
                  onClick={() => nudgeBoundary("end_time", 0.5)}
                  className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5"
                >
                  종료 +0.5초
                </button>
              </div>
            </div>

            <div className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">제목</span>
                <input
                  value={form.suggested_title}
                  onChange={(event) => setForm((current) => ({ ...current, suggested_title: event.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-cyan-300/40"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">설명</span>
                <textarea
                  rows={3}
                  value={form.suggested_description}
                  onChange={(event) => setForm((current) => ({ ...current, suggested_description: event.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-cyan-300/40"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">해시태그</span>
                <input
                  value={form.suggested_hashtags}
                  onChange={(event) => setForm((current) => ({ ...current, suggested_hashtags: event.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-cyan-300/40"
                />
              </label>
            </div>

            {validationError ? (
              <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{validationError}</div>
            ) : null}

            {latestFailedExportJob ? (
              <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-4 text-sm text-rose-100">
                <p className="font-semibold">최근 내보내기 실패</p>
                <p className="mt-2 leading-6 text-white/85">{latestFailedExportJob.error_detail ?? "원본 파일과 FFmpeg 상태를 확인해 주세요."}</p>
              </div>
            ) : null}

            {latestFailedPublishJob ? (
              <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-4 text-sm text-amber-50">
                <p className="font-semibold">최근 게시 큐 실패</p>
                <p className="mt-2 leading-6 text-white/85">{latestFailedPublishJob.error_detail ?? "최신 export와 메타데이터를 확인한 뒤 다시 시도해 주세요."}</p>
              </div>
            ) : null}

            <div className="grid gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || Boolean(validationError) || Boolean(activeExportJob)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? "저장 중..." : "저장"}
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={saving || statusSubmitting !== null || Boolean(validationError) || Boolean(activeExportJob)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm font-medium text-emerald-200 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                {statusSubmitting === "approve" ? "승인 중..." : "승인"}
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={!canExport || Boolean(activeExportJob)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                {activeExportJob ? `${activeExportJob.progress}% · 내보내는 중` : "숏츠 내보내기"}
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRejectOpen(true)}
                  disabled={saving || statusSubmitting !== null || Boolean(activeExportJob)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-400/15 px-4 py-3 text-sm font-medium text-rose-200 transition hover:bg-rose-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                  반려
                </button>
                <button
                  type="button"
                  onClick={handleResetReview}
                  disabled={saving || statusSubmitting !== null || clip.status === "pending" || Boolean(activeExportJob)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  되돌리기
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">모의 게시</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">export가 끝난 뒤 플랫폼 큐에 넣을 수 있습니다.</p>
                </div>
                <StatusBadge status={clip.latest_export?.output_url ? "ready" : "not_connected"} />
              </div>
              <div className="mt-4 grid gap-2">
                {["youtube", "instagram", "tiktok"].map((platform) => (
                  <button
                    key={platform}
                    type="button"
                    disabled={!canPublish}
                    onClick={() => handleQueuePublish(platform)}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    {activePublishJob?.payload_json?.platform === platform ? `${activePublishJob.progress}% · 등록 중` : `${platform} 큐에 넣기`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {relevantJobs.length ? (
        <details className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
          <summary className="cursor-pointer text-sm font-medium text-white">자동화 작업 내역 보기</summary>
          <div className="mt-4">
            <WorkflowJobList
              jobs={relevantJobs}
              title="클립 자동화 작업"
              description="내보내기와 게시 작업은 백그라운드에서 이어집니다."
              emptyTitle="이 클립의 내보내기 및 게시 작업이 여기에 표시됩니다."
            />
          </div>
        </details>
      ) : null}

      <ConfirmModal
        open={rejectOpen}
        title="이 클립을 반려할까요?"
        description="검토 큐에서 이 클립을 반려 상태로 표시합니다. 우선순위가 바뀌면 나중에 다시 열어 수정할 수 있습니다."
        confirmLabel="클립 반려"
        onConfirm={handleReject}
        onClose={() => setRejectOpen(false)}
      />
    </div>
  );
}
