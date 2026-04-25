import { Check, Clock3, Download, ExternalLink, RotateCcw, Save, Send, SkipBack, SkipForward, X } from "lucide-react";
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
  { value: "clean", label: "클린", note: "균형 잡힌 크기와 은은한 외곽선으로 안정적인 스타일입니다." },
  { value: "bold", label: "볼드", note: "대비를 높이고 강조를 강하게 준 스타일입니다." },
  { value: "creator", label: "크리에이터", note: "숏폼 에너지에 맞춰 더 강한 자막 처리를 적용합니다." },
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
        description: "타이밍, 메타데이터, 자막 스타일이 다음 내보내기에 맞춰 반영되었습니다.",
      });
      pushToast({ tone: "success", title: "클립을 저장했습니다", description: "타이밍, 메타데이터, 자막 프리셋을 업데이트했습니다." });
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

  const preflightItems = [
    { label: "클립 승인됨", ready: clip.status === "approved" || clip.status === "exported" },
    { label: "타이밍 유효", ready: !validationError },
    { label: "메타데이터 입력 완료", ready: Boolean(form.suggested_title.trim() && form.suggested_description.trim() && form.suggested_hashtags.trim()) },
    { label: "내보내기 준비 완료", ready: clip.status === "approved" || clip.status === "exported" },
    { label: "게시 큐 등록 가능", ready: Boolean(clip.latest_export?.output_url) && !activePublishJob },
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
                  <div className="flex h-full items-center justify-center text-slate-500">미리보기를 사용할 수 없습니다</div>
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
                시작 지점으로 이동
              </button>
              <button
                type="button"
                onClick={() => seekPreviewTo(Math.max(form.start_time, form.end_time - 1))}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5"
              >
                <SkipForward className="h-4 w-4" />
                끝 지점으로 이동
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6">
          <h3 className="font-display text-xl font-semibold text-white">빠른 확인</h3>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-black/20 p-4">
              <p className="text-xs text-slate-500">시작</p>
              <p className="mt-2 font-semibold text-white">{form.start_time.toFixed(2)}s</p>
            </div>
            <div className="rounded-2xl bg-black/20 p-4">
              <p className="text-xs text-slate-500">종료</p>
              <p className="mt-2 font-semibold text-white">{form.end_time.toFixed(2)}s</p>
            </div>
            <div className="rounded-2xl bg-black/20 p-4">
              <p className="text-xs text-slate-500">자막 프리셋</p>
              <p className="mt-2 font-semibold capitalize text-white">{form.subtitle_preset}</p>
            </div>
            <div className="rounded-2xl bg-black/20 p-4">
              <p className="text-xs text-slate-500">최근 내보내기</p>
              <p className="mt-2 font-semibold text-white">{clip.latest_export?.status ?? "없음"}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
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
          {clip.latest_export?.output_url ? (
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate("/exports")}
                className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5"
              >
                내보내기 목록 보기
              </button>
              <a
                href={resolveMediaUrl(clip.latest_export.output_url)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/15"
              >
                <ExternalLink className="h-4 w-4" />
                결과 영상 열기
              </a>
            </div>
          ) : null}

          {latestFailedExportJob ? (
            <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-4 text-sm text-rose-100">
              <p className="font-semibold">최근 내보내기 작업이 실패했습니다</p>
              <p className="mt-2 leading-6 text-white/85">
                {latestFailedExportJob.error_detail ?? "FFmpeg나 원본 파일 상태를 확인한 뒤 다시 내보내기를 시도해 주세요."}
              </p>
              <button
                type="button"
                onClick={() => void handleExport()}
                disabled={Boolean(activeExportJob) || Boolean(validationError)}
                className="mt-4 rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                내보내기 다시 시도
              </button>
            </div>
          ) : null}
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-display text-xl font-semibold text-white">내보내기 사전 점검</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">백그라운드 렌더링이나 게시 큐 등록을 시작하기 전에 이 체크리스트를 확인하세요.</p>
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
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">리뷰</p>
              <h3 className="mt-3 font-display text-3xl font-semibold text-white">{project.title}</h3>
              <p className="mt-2 text-sm text-slate-400">내보내기 전에 타이밍, 메타데이터, 자막 스타일을 세밀하게 조정하세요.</p>
            </div>
            <StatusBadge status={clip.status} />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-[0.9fr,1.1fr]">
            <div className="rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.08] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/75">추천 포맷</p>
              <p className="mt-2 text-lg font-semibold text-white">{clip.recommended_format ?? "기본 포맷"}</p>
              <p className="mt-2 text-sm leading-6 text-cyan-50/85">
                {clip.content_profile_label ?? "일반"} · {clip.virality_label ?? "검토 중"} · {clip.timeline_label ?? "구간 정보 없음"}
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">왜 이 후보인가</p>
              <p className="mt-2 text-sm leading-6 text-white/90">{clip.selection_reason ?? "현재 후보의 핵심 신호를 계산하는 중입니다."}</p>
              {(clip.selection_signals ?? []).length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {(clip.selection_signals ?? []).map((signal) => (
                    <span key={signal} className="rounded-full bg-white/6 px-3 py-1 text-xs text-slate-200">
                      {signal}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[0.92fr,1.08fr]">
            <div className="rounded-3xl border border-violet-300/15 bg-violet-300/[0.08] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-violet-200/75">분석형 숏츠 패키지</p>
              <p className="mt-2 text-lg font-semibold text-white">{clip.analysis_headline ?? "분석 헤드라인 준비 중"}</p>
              <p className="mt-2 text-sm leading-6 text-violet-50/85">
                {clip.story_angle ?? "핵심 장면 분석"} · {clip.title_treatment ?? "상단 타이틀 처리 준비 중"}
              </p>
              <p className="mt-2 text-sm leading-6 text-violet-50/80">{clip.caption_treatment ?? "하단 자막 처리 준비 중"}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">추천 해설 자막</p>
              {(clip.analysis_outline ?? []).length ? (
                <div className="mt-3 space-y-2">
                  {(clip.analysis_outline ?? []).map((line, index) => (
                    <div key={`${index}-${line}`} className="rounded-2xl bg-white/5 px-4 py-3 text-sm leading-6 text-white/90">
                      {index + 1}. {line}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm leading-6 text-slate-300">아직 자동 해설 자막이 준비되지 않았습니다.</p>
              )}
            </div>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
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
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-slate-300">제목</span>
              <input
                value={form.suggested_title}
                onChange={(event) => setForm((current) => ({ ...current, suggested_title: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-cyan-300/40"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-slate-300">설명</span>
              <textarea
                rows={4}
                value={form.suggested_description}
                onChange={(event) => setForm((current) => ({ ...current, suggested_description: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-cyan-300/40"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-slate-300">해시태그</span>
              <input
                value={form.suggested_hashtags}
                onChange={(event) => setForm((current) => ({ ...current, suggested_hashtags: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-cyan-300/40"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-slate-300">자막 프리셋</span>
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

          {latestFailedPublishJob ? (
            <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-50">
              <p className="font-semibold">최근 게시 큐 등록이 실패했습니다</p>
              <p className="mt-2 leading-6 text-white/85">
                {latestFailedPublishJob.error_detail ?? "메타데이터와 최신 export 자산을 점검한 뒤 다시 게시 큐에 넣어 주세요."}
              </p>
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
              {saving ? "저장 중..." : "저장"}
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={saving || statusSubmitting !== null || Boolean(validationError) || Boolean(activeExportJob)}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm font-medium text-emerald-200 transition hover:bg-emerald-400/20"
            >
              <Check className="h-4 w-4" />
              {statusSubmitting === "approve" ? "승인 중..." : "승인"}
            </button>
            <button
              type="button"
              onClick={() => setRejectOpen(true)}
              disabled={saving || statusSubmitting !== null || Boolean(activeExportJob)}
              className="inline-flex items-center gap-2 rounded-2xl bg-rose-400/15 px-4 py-3 text-sm font-medium text-rose-200 transition hover:bg-rose-400/20"
            >
              <X className="h-4 w-4" />
              반려
            </button>
            <button
              type="button"
              onClick={handleResetReview}
              disabled={saving || statusSubmitting !== null || clip.status === "pending" || Boolean(activeExportJob)}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              검토 상태 되돌리기
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={(clip.status !== "approved" && clip.status !== "exported") || Boolean(activeExportJob) || Boolean(validationError)}
              className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {activeExportJob ? `${activeExportJob.progress}% · 내보내는 중` : "1080x1920으로 내보내기"}
            </button>
          </div>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="font-display text-xl font-semibold text-white">모의 게시</h3>
              <p className="mt-2 text-sm text-slate-400">내보낸 클립을 모의 플랫폼 어댑터에 등록합니다. 실제 업로드는 v1 범위에서 의도적으로 제외했습니다.</p>
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
                {activePublishJob?.payload_json?.platform === platform ? `${activePublishJob.progress}% · 등록 중` : `${platform} 큐에 넣기`}
              </button>
            ))}
          </div>
        </div>

        <WorkflowJobList
          jobs={relevantJobs}
          title="클립 자동화 작업"
          description="타이밍과 메타데이터를 계속 조정하는 동안 내보내기와 게시 작업은 백그라운드에서 이어집니다."
          emptyTitle="이 클립의 내보내기 및 게시 작업이 여기에 표시됩니다."
        />
      </section>

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
