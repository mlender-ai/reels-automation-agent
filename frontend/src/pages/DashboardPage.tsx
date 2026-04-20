import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api";
import { ClipCard } from "../components/ClipCard";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { ExportListTable } from "../components/ExportListTable";
import { LoadingState } from "../components/LoadingState";
import { ProjectSummaryCard } from "../components/ProjectSummaryCard";
import { StatCard } from "../components/StatCard";
import { SystemStatusCard } from "../components/SystemStatusCard";
import { useToast } from "../hooks/useToast";
import type { DashboardSummary, SystemStatus } from "../types";

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const { pushToast } = useToast();

  async function load() {
    try {
      setLoading(true);
      setErrorMessage("");
      const [summaryResponse, systemResponse] = await Promise.all([api.getDashboardSummary(), api.getSystemStatus()]);
      setSummary(summaryResponse);
      setSystemStatus(systemResponse);
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

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="프로젝트" value={summary.total_projects} hint="작업 중 라이브러리" />
        <StatCard label="검토 대기" value={summary.pending_review_count} hint="판단 필요" />
        <StatCard label="승인된 클립" value={summary.approved_count} hint="내보내기 가능" />
        <StatCard label="완료된 내보내기" value={summary.export_count} hint="최종 산출물" />
      </section>

      {!summary.total_projects ? (
        <EmptyState
          title="첫 로컬 프로젝트를 만들어보세요"
          description="먼저 내 컴퓨터의 긴 영상을 업로드하세요. 이후 자막 추출, 후보 생성, 검토, 내보내기, 모의 게시 큐까지 이어집니다."
          actionLabel="프로젝트 만들기"
          actionHref="/projects/new"
        />
      ) : null}

      {systemStatus ? <SystemStatusCard status={systemStatus} /> : null}

      <section className="grid gap-8 xl:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl font-semibold text-white">최근 프로젝트</h3>
            <Link to="/projects/new" className="text-sm font-medium text-cyan-200 hover:text-cyan-100">
              새 프로젝트
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {summary.recent_projects.map((project) => (
              <ProjectSummaryCard key={project.id} project={project} />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl font-semibold text-white">검토 대기</h3>
            <span className="text-sm text-slate-400">현재 {summary.pending_review_clips.length}개</span>
          </div>
          {summary.pending_review_clips.length ? (
            <div className="grid gap-4">
              {summary.pending_review_clips.map((clip) => (
                <ClipCard key={clip.id} clip={clip} compact />
              ))}
            </div>
          ) : (
            <EmptyState
              title="대기 중인 후보가 없습니다"
              description="클립 후보를 생성하면 점수가 높은 장면이 여기에 표시되어 빠르게 검토할 수 있습니다."
            />
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold text-white">최근 내보내기</h3>
          <Link to="/exports" className="text-sm font-medium text-cyan-200 hover:text-cyan-100">
            전체 보기
          </Link>
        </div>
        {summary.recent_exports.length ? (
          <ExportListTable items={summary.recent_exports} />
        ) : (
          <EmptyState title="아직 내보낸 결과가 없습니다" description="클립을 승인하고 내보내기를 실행하면 첫 세로형 MP4 결과가 생성됩니다." />
        )}
      </section>
    </div>
  );
}
