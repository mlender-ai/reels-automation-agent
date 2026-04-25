import { Film, FolderOpen, PlayCircle, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../hooks/useToast";
import { formatDateTime } from "../lib/formatters";
import { resolveMediaUrl } from "../lib/media";
import type { DashboardSummary } from "../types";

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const { pushToast } = useToast();

  async function load() {
    try {
      setLoading(true);
      setErrorMessage("");
      const summaryResponse = await api.getDashboardSummary();
      setSummary(summaryResponse);
    } catch (error) {
      const message = (error as Error).message;
      setErrorMessage(message);
      pushToast({ tone: "error", title: "대시보드를 불러오지 못했습니다", description: message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [pushToast]);

  const featuredExport = useMemo(() => summary?.recent_exports?.[0] ?? null, [summary]);
  const pendingReview = useMemo(() => summary?.pending_review_clips?.slice(0, 4) ?? [], [summary]);
  const recentProjects = useMemo(() => summary?.recent_projects?.slice(0, 4) ?? [], [summary]);
  const recentExports = useMemo(() => summary?.recent_exports?.slice(0, 4) ?? [], [summary]);

  if (loading) {
    return <LoadingState label="대시보드를 불러오는 중..." />;
  }

  if (!summary) {
    return (
      <ErrorState
        title="대시보드를 사용할 수 없습니다"
        description={errorMessage || "API에서 대시보드 데이터를 가져오지 못했습니다. 백엔드가 실행 중인지 확인해 주세요."}
        actionLabel="다시 불러오기"
        onAction={() => void load()}
      />
    );
  }

  if (!summary.total_projects) {
    return (
      <EmptyState
        title="첫 로컬 프로젝트를 만들어보세요"
        description="긴 영상을 업로드하면 자막, 후보 생성, 리뷰, 내보내기까지 한 번에 이어집니다."
        actionLabel="프로젝트 만들기"
        actionHref="/projects/new"
      />
    );
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 rounded-[32px] border border-white/10 bg-white/[0.04] p-6 xl:grid-cols-[1.12fr,0.88fr]">
        <div className="space-y-5">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">지금 바로 볼 것</p>
            <h2 className="mt-3 font-display text-3xl font-semibold text-white">가장 최근에 만든 숏츠</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              대시보드는 이제 복잡한 운영 정보보다 결과물 확인을 먼저 보여줍니다. 아래 미리보기에서 바로 영상을 보고, 리뷰 화면이나 프로젝트 상세로
              바로 이동할 수 있습니다.
            </p>
          </div>

          {featuredExport ? (
            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-black/40">
              <div className="grid gap-0 xl:grid-cols-[0.74fr,1.26fr]">
                <div className="border-b border-white/10 bg-black/50 xl:border-b-0 xl:border-r">
                  <div className="mx-auto max-w-[340px] p-5">
                    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-black">
                      <video
                        controls
                        poster={featuredExport.thumbnail_url ? resolveMediaUrl(featuredExport.thumbnail_url) : undefined}
                        src={featuredExport.output_url ? resolveMediaUrl(featuredExport.output_url) : undefined}
                        className="aspect-[9/16] w-full object-cover"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-medium text-white/85">최근 결과물</span>
                    <StatusBadge status={featuredExport.status} />
                  </div>

                  <div>
                    <h3 className="text-2xl font-semibold text-white">{featuredExport.clip_title ?? `Clip #${featuredExport.clip_candidate_id}`}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      생성 시각 {formatDateTime(featuredExport.created_at)}
                      {featuredExport.project_id ? ` · 프로젝트 ${featuredExport.project_id}` : ""}
                    </p>
                  </div>

                  <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300 md:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">영상</p>
                      <p className="mt-2 font-medium text-white">바로 재생 가능</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">리뷰</p>
                      <p className="mt-2 font-medium text-white">클립 상세 편집으로 이동</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">프로젝트</p>
                      <p className="mt-2 font-medium text-white">원본과 결과를 함께 확인</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {featuredExport.output_url ? (
                      <a
                        href={resolveMediaUrl(featuredExport.output_url)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
                      >
                        <PlayCircle className="h-4 w-4" />
                        영상 바로 보기
                      </a>
                    ) : null}
                    <Link
                      to={featuredExport.clip_candidate_id ? `/clips/${featuredExport.clip_candidate_id}` : "/exports"}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5"
                    >
                      <Sparkles className="h-4 w-4" />
                      리뷰 화면 열기
                    </Link>
                    {featuredExport.project_id ? (
                      <Link
                        to={`/projects/${featuredExport.project_id}`}
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5"
                      >
                        <FolderOpen className="h-4 w-4" />
                        프로젝트 열기
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState title="아직 결과물이 없습니다" description="클립을 승인하고 내보내기를 실행하면 여기에 가장 최근 숏츠가 먼저 표시됩니다." />
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-[28px] border border-white/10 bg-black/25 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">빠른 현황</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/[0.04] p-4">
                <p className="text-xs text-slate-500">프로젝트</p>
                <p className="mt-2 text-2xl font-semibold text-white">{summary.total_projects}</p>
              </div>
              <div className="rounded-2xl bg-white/[0.04] p-4">
                <p className="text-xs text-slate-500">검토 대기</p>
                <p className="mt-2 text-2xl font-semibold text-white">{summary.pending_review_count}</p>
              </div>
              <div className="rounded-2xl bg-white/[0.04] p-4">
                <p className="text-xs text-slate-500">승인됨</p>
                <p className="mt-2 text-2xl font-semibold text-white">{summary.approved_count}</p>
              </div>
              <div className="rounded-2xl bg-white/[0.04] p-4">
                <p className="text-xs text-slate-500">내보내기</p>
                <p className="mt-2 text-2xl font-semibold text-white">{summary.export_count}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-black/25 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">검토할 후보</p>
              <Link to="/projects/new" className="text-sm font-medium text-cyan-200 hover:text-cyan-100">
                새 프로젝트
              </Link>
            </div>
            {pendingReview.length ? (
              <div className="mt-4 space-y-3">
                {pendingReview.map((clip) => (
                  <Link
                    key={clip.id}
                    to={`/clips/${clip.id}`}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:bg-white/[0.05]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{clip.suggested_title}</p>
                      <p className="mt-1 truncate text-xs text-slate-400">{clip.analysis_headline ?? clip.hook_text}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white/8 px-3 py-1 text-xs text-white/85">{clip.recommended_format ?? "기본형"}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-slate-400">지금 검토 대기 중인 후보가 없습니다.</p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-xl font-semibold text-white">최근 결과물 목록</h3>
            <Link to="/exports" className="text-sm font-medium text-cyan-200 hover:text-cyan-100">
              전체 보기
            </Link>
          </div>
          {recentExports.length ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {recentExports.map((item) => (
                <article key={item.id} className="overflow-hidden rounded-3xl border border-white/10 bg-black/25">
                  <a href={item.output_url ? resolveMediaUrl(item.output_url) : "#"} target="_blank" rel="noreferrer" className="block">
                    <div className="aspect-[9/16] overflow-hidden bg-black">
                      {item.thumbnail_url ? (
                        <img src={resolveMediaUrl(item.thumbnail_url)} alt={item.clip_title ?? `Export ${item.id}`} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-slate-500">미리보기 없음</div>
                      )}
                    </div>
                  </a>
                  <div className="space-y-3 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-semibold text-white">{item.clip_title ?? `Clip #${item.clip_candidate_id}`}</p>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="text-xs text-slate-500">{formatDateTime(item.created_at)}</p>
                    <div className="flex flex-wrap gap-2">
                      {item.output_url ? (
                        <a
                          href={resolveMediaUrl(item.output_url)}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-2xl bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/15"
                        >
                          영상 보기
                        </a>
                      ) : null}
                      {item.clip_candidate_id ? (
                        <Link to={`/clips/${item.clip_candidate_id}`} className="rounded-2xl border border-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/5">
                          리뷰
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="최근 결과물이 없습니다" description="승인 후 내보내기를 실행하면 여기에서 바로 확인할 수 있습니다." />
          )}
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-xl font-semibold text-white">최근 프로젝트</h3>
            <Link to="/projects/new" className="text-sm font-medium text-cyan-200 hover:text-cyan-100">
              만들기
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {recentProjects.map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="flex items-center justify-between gap-4 rounded-3xl border border-white/10 bg-black/25 px-4 py-4 transition hover:bg-white/[0.05]"
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-white">{project.title}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    후보 {project.clip_count}개 · 승인 {project.approved_clip_count}개 · 내보내기 {project.export_count}개
                  </p>
                </div>
                <div className="shrink-0">
                  <StatusBadge status={project.status} />
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-6 rounded-3xl border border-white/10 bg-black/25 p-4">
            <div className="flex items-center gap-2">
              <Film className="h-4 w-4 text-white/80" />
              <p className="text-sm font-medium text-white">보는 순서</p>
            </div>
            <div className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
              <p>1. 맨 위의 최근 숏츠를 먼저 재생</p>
              <p>2. 마음에 들면 리뷰 화면으로 들어가서 문구 수정</p>
              <p>3. 프로젝트 상세에서 원본과 결과물을 같이 비교</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
