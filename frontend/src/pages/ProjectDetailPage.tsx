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
  const [previewMode, setPreviewMode] = useState<"source" | "export">("source");
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
      pushToast({ tone: "error", title: "프로젝트를 불러오지 못했습니다", description: message });
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
      pushToast({ tone: "error", title: "프로젝트를 불러오지 못했습니다", description: message });
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
            ? "새 클립 후보가 준비되었습니다. 이제 검토 화면으로 이동해 확인할 수 있습니다."
            : "자막 추출이 끝났습니다. 이제 다음 단계로 넘어갈 수 있습니다.";
        setActionNotice({ tone: "success", title: `${workflowJobTypeLabel(job.job_type)} 완료`, description });
        pushToast({ tone: "success", title: `${workflowJobTypeLabel(job.job_type)} 완료`, description });
        if (job.job_type === "generate_clips" && navigateOnClipReady) {
          setNavigateOnClipReady(false);
          navigate(`/projects/${projectId}/clips`);
        }
      } else if (job.status === "failed") {
        const description = job.error_detail ?? "로컬 런타임 도구와 원본 영상을 확인한 뒤 이 단계를 다시 실행해 주세요.";
        setActionNotice({ tone: "error", title: `${workflowJobTypeLabel(job.job_type)} 실패`, description });
        pushToast({ tone: "error", title: `${workflowJobTypeLabel(job.job_type)} 실패`, description });
        if (job.job_type === "generate_clips") {
          setNavigateOnClipReady(false);
        }
      }
    }
  }, [jobs, navigateOnClipReady, projectId, pushToast, relevantJobs, navigate]);

  useEffect(() => {
    if (!project) return;
    setPreviewMode(project.latest_export?.output_url ? "export" : "source");
  }, [project]);

  async function handleTranscribe() {
    if (!projectId) return;
    try {
      setSubmittingAction("transcribe");
      setActionNotice(null);
      const job = await api.startProjectTranscriptionJob(projectIdNumber);
      setJobs((current) => upsertJob(current, job));
      setActionNotice({
        tone: "info",
        title: "자막 추출을 대기열에 등록했습니다",
        description: "자막 추출이 백그라운드에서 실행됩니다. 이 화면은 진행률을 자동으로 새로고침합니다.",
      });
      pushToast({ tone: "success", title: "자막 추출을 시작했습니다", description: "백그라운드 자막 추출이 시작되었습니다." });
    } catch (error) {
      const message = (error as Error).message;
      setActionNotice({
        tone: "error",
        title: "자막 추출을 시작하지 못했습니다",
        description: `${message} 원본 영상의 오디오 트랙이나 로컬 faster-whisper 설정을 확인한 뒤 다시 시도해 주세요.`,
      });
      pushToast({ tone: "error", title: "자막 추출을 시작하지 못했습니다", description: message });
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
        title: "클립 후보 생성을 대기열에 등록했습니다",
        description: "후보 점수화가 백그라운드에서 실행됩니다. 새 후보가 준비되면 자동으로 후보 목록으로 이동합니다.",
      });
      pushToast({ tone: "success", title: "클립 후보 생성을 시작했습니다", description: "숏폼 후보 랭킹 작업이 시작되었습니다." });
    } catch (error) {
      const message = (error as Error).message;
      setActionNotice({
        tone: "error",
        title: "클립 후보 생성을 시작하지 못했습니다",
        description: `${message} 자막 내용을 확인한 뒤 다시 시도하거나, 더 선명한 원본 영상으로 자막을 다시 생성해 주세요.`,
      });
      pushToast({ tone: "error", title: "클립 후보 생성을 시작하지 못했습니다", description: message });
    } finally {
      setSubmittingAction(null);
    }
  }

  if (loading) return <LoadingState label="프로젝트를 불러오는 중..." />;
  if (!project) {
    if (pageError) {
      return <ErrorState title="프로젝트를 불러올 수 없습니다" description={pageError} actionLabel="다시 시도" onAction={() => void loadPage()} />;
    }
    return <EmptyState title="프로젝트를 찾을 수 없습니다" description="로컬 API에서 이 프로젝트를 불러오지 못했습니다." />;
  }

  const hasSource = Boolean(project.source_video);
  const hasTranscript = Boolean(project.latest_transcript);
  const hasClips = project.clip_count > 0;
  const workflowLock = Boolean(activeProjectJob || submittingAction);
  const nextActionText = activeProjectJob
    ? `${workflowJobTypeLabel(activeProjectJob.job_type)} 진행 중`
    : nextActionLabel(project.next_action);
  const hasLatestExport = Boolean(project.latest_export?.output_url);
  const previewUrl =
    previewMode === "export"
      ? resolveMediaUrl(project.latest_export?.output_url)
      : resolveMediaUrl(project.source_video?.file_url);
  const previewPoster =
    previewMode === "export"
      ? resolveMediaUrl(project.latest_export?.thumbnail_url)
      : "";
  const previewTitle = previewMode === "export" ? "실제 결과물 미리보기" : "원본 영상 미리보기";
  const previewDescription =
    previewMode === "export"
      ? "실제로 생성된 9:16 숏폼 결과물입니다. 제목 오버레이와 캡션이 반영된 최신 export를 바로 확인할 수 있습니다."
      : "업로드된 원본 소스입니다. 클립 후보, export, publish는 이 파일을 기준으로 진행됩니다.";
  const previewAspectClass = previewMode === "export" ? "aspect-[9/16]" : "aspect-video";
  const previewDurationSeconds = project.source_video?.duration_seconds ?? null;

  return (
    <div className="space-y-8">
      <section className="grid gap-8 xl:grid-cols-[1.05fr,0.95fr]">
        <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-panel">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">프로젝트</p>
              <h3 className="mt-3 font-display text-3xl font-semibold text-white">{project.title}</h3>
              <p className="mt-3 text-sm text-slate-400">생성일 {formatDateTime(project.created_at)}</p>
            </div>
            <StatusBadge status={activeProjectJob?.status ?? project.status} />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-3xl bg-black/20 p-4">
              <p className="text-xs text-slate-500">자막</p>
              <p className="mt-2 text-lg font-semibold text-white">{hasTranscript ? "준비됨" : "없음"}</p>
            </div>
            <div className="rounded-3xl bg-black/20 p-4">
              <p className="text-xs text-slate-500">클립 후보</p>
              <p className="mt-2 text-lg font-semibold text-white">{project.clip_count}</p>
              <p className="mt-2 text-xs text-slate-500">
                검토 대기 {project.pending_clip_count}개 · 승인 {project.approved_clip_count}개
              </p>
            </div>
            <div className="rounded-3xl bg-black/20 p-4">
              <p className="text-xs text-slate-500">내보내기</p>
              <p className="mt-2 text-lg font-semibold text-white">{project.export_count}</p>
              <p className="mt-2 text-xs text-slate-500">반려 {project.rejected_clip_count}개 추적 중</p>
            </div>
            <div className="rounded-3xl bg-black/20 p-4">
              <p className="text-xs text-slate-500">자동화 작업</p>
              <p className="mt-2 text-lg font-semibold text-white">{activeProjectJob ? `${activeProjectJob.progress}%` : "대기"}</p>
              <p className="mt-2 text-xs text-slate-500">{activeProjectJob?.message ?? "현재 백그라운드 작업이 없습니다."}</p>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-cyan-300/15 bg-cyan-300/8 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">다음 액션</p>
            <p className="mt-2 text-sm font-medium text-cyan-100">{nextActionText}</p>
            {hasSource ? (
              <p className="mt-2 text-sm leading-6 text-cyan-50/80">
                이 단계가 끝나면 원본 {previewDurationSeconds ? formatDuration(previewDurationSeconds) : ""}를 기준으로 조회수형 숏츠 후보를 3~5개 자동 추천합니다.
              </p>
            ) : null}
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
              <p className="text-sm font-semibold">{actionNotice?.title ?? "최근 자동화 단계에 확인이 필요합니다"}</p>
              <p className="mt-2 text-sm leading-6 text-white/85">
                {actionNotice?.description ??
                  "최근 프로젝트 단계가 실패했습니다. 로컬 원본 파일과 런타임 도구를 확인한 뒤 이 화면에서 다시 시도해 주세요."}
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
                ? `${activeProjectJob.progress}% · 자막 추출 중`
                : hasTranscript
                  ? "자막 다시 생성"
                  : "자막 추출"}
            </button>
            <button
              type="button"
              disabled={!hasTranscript || workflowLock}
              onClick={handleGenerateClips}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm font-medium text-emerald-200 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Wand2 className="h-4 w-4" />
              {activeProjectJob?.job_type === "generate_clips"
                ? `${activeProjectJob.progress}% · 후보 생성 중`
                : hasClips
                  ? "클립 후보 다시 생성"
                  : "클립 후보 생성"}
            </button>
            {hasClips ? (
              <Link
                to={`/projects/${project.id}/clips`}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5"
              >
                <Sparkles className="h-4 w-4" />
                후보 보기
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white/45"
              >
                <Sparkles className="h-4 w-4" />
                후보 보기
              </button>
            )}
          </div>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-4 shadow-panel">
          {project.source_video?.file_url || project.latest_export?.output_url ? (
            <div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">미리보기</p>
                  <h3 className="mt-2 font-display text-xl font-semibold text-white">{previewTitle}</h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">{previewDescription}</p>
                </div>
                {hasLatestExport ? (
                  <div className="inline-flex rounded-2xl border border-white/10 bg-black/20 p-1">
                    <button
                      type="button"
                      onClick={() => setPreviewMode("export")}
                      className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                        previewMode === "export" ? "bg-cyan-300 text-slate-950" : "text-slate-300 hover:bg-white/5"
                      }`}
                    >
                      결과물
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode("source")}
                      className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                        previewMode === "source" ? "bg-white text-slate-950" : "text-slate-300 hover:bg-white/5"
                      }`}
                    >
                      원본
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="overflow-hidden rounded-[28px] border border-white/10 bg-black/30">
                <video
                  controls
                  poster={previewPoster || undefined}
                  src={previewUrl}
                  className={`${previewAspectClass} w-full bg-black ${previewMode === "export" ? "object-cover" : "object-contain"}`}
                />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-2xl bg-black/20 p-3">
                  <p className="text-xs text-slate-500">{previewMode === "export" ? "결과 길이" : "원본 길이"}</p>
                  <p className="mt-2 font-semibold text-white">{formatDuration(previewDurationSeconds)}</p>
                </div>
                <div className="rounded-2xl bg-black/20 p-3">
                  <p className="text-xs text-slate-500">해상도</p>
                  <p className="mt-2 font-semibold text-white">
                    {previewMode === "export"
                      ? "1080 x 1920"
                      : `${project.source_video?.width ?? "--"} x ${project.source_video?.height ?? "--"}`}
                  </p>
                </div>
                <div className="rounded-2xl bg-black/20 p-3">
                  <p className="text-xs text-slate-500">{previewMode === "export" ? "표시 요소" : "FPS"}</p>
                  <p className="mt-2 font-semibold text-white">
                    {previewMode === "export" ? (project.latest_export?.thumbnail_url ? "타이틀 + 캡션" : "세로형 변환") : project.source_video?.fps ?? "--"}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                {project.latest_export?.output_url ? (
                  <a
                    href={resolveMediaUrl(project.latest_export.output_url)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
                  >
                    최신 결과물 열기
                  </a>
                ) : null}
                {project.latest_export?.thumbnail_url ? (
                  <a
                    href={resolveMediaUrl(project.latest_export.thumbnail_url)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5"
                  >
                    썸네일 보기
                  </a>
                ) : null}
                <Link
                  to="/exports"
                  className="inline-flex rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5"
                >
                  내보내기 화면으로 이동
                </Link>
              </div>
            </div>
          ) : (
            <EmptyState
              title="원본 영상이 없습니다"
              description="아직 이 프로젝트에 업로드된 영상이 없습니다. 새 프로젝트 화면으로 돌아가 로컬 원본 영상을 추가해 주세요."
            />
          )}
        </div>
      </section>

      <section className="grid gap-8 xl:grid-cols-[1fr,1fr]">
        <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6">
          <h3 className="font-display text-xl font-semibold text-white">자막 상태</h3>
          {project.latest_transcript ? (
            <div className="mt-4 space-y-3">
              <StatusBadge status="transcribed" />
              <p className="text-sm leading-6 text-slate-300">{truncate(project.latest_transcript.text, 320)}</p>
              <p className="text-xs text-slate-500">
                모델 {project.latest_transcript.model_name} · 언어 {project.latest_transcript.language ?? "자동 감지"}
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-slate-400">
              아직 자막이 생성되지 않았습니다. 자막 추출을 실행하면 규칙 기반 클립 후보 탐색을 시작할 수 있습니다.
            </p>
          )}
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6">
          <h3 className="font-display text-xl font-semibold text-white">다음 단계 안내</h3>
          <div className="mt-4 space-y-4 text-sm leading-6 text-slate-300">
            <p>1. 원본 영상이 바뀌면 자막을 새로 추출하거나 다시 생성하세요.</p>
            <p>2. 클립 후보를 생성해 더 강한 숏폼 구간으로 검토 대기열을 업데이트하세요.</p>
            <p>3. 유망한 후보를 승인하고 1080x1920 MP4로 내보낸 뒤 게시 큐에 넣으세요.</p>
          </div>
        </div>
      </section>

      <WorkflowJobList
        jobs={relevantJobs}
        title="자동화 작업 내역"
        description="프로젝트 단위 작업은 페이지를 막지 않고 자막 추출과 클립 후보 생성을 백그라운드에서 처리합니다."
        emptyTitle="자막 추출과 클립 후보 생성 작업이 여기에 표시됩니다."
      />
    </div>
  );
}
