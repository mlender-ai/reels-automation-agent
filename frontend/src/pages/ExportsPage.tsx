import { useEffect, useState } from "react";

import { api } from "../api";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { ExportListTable } from "../components/ExportListTable";
import { LoadingState } from "../components/LoadingState";
import { StatCard } from "../components/StatCard";
import { useToast } from "../hooks/useToast";
import type { ExportRecord } from "../types";

export function ExportsPage() {
  const [items, setItems] = useState<ExportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const { pushToast } = useToast();

  async function load() {
    try {
      setLoading(true);
      setErrorMessage("");
      setItems(await api.listExports());
    } catch (error) {
      const message = (error as Error).message;
      setErrorMessage(message);
      pushToast({ tone: "error", title: "내보내기 목록을 불러오지 못했습니다", description: message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [pushToast]);

  if (loading) return <LoadingState label="내보내기 목록을 불러오는 중..." />;
  if (errorMessage && !items.length) {
    return <ErrorState title="내보내기 화면을 사용할 수 없습니다" description={errorMessage} actionLabel="다시 시도" onAction={() => void load()} />;
  }
  if (!items.length) {
    return <EmptyState title="아직 내보낸 결과가 없습니다" description="클립을 승인하고 내보내기를 실행하면 첫 세로형 MP4 자산이 생성됩니다." />;
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="내보내기" value={items.length} hint="전체 작업" />
        <StatCard label="완료" value={items.filter((item) => item.status === "completed").length} hint="재생 가능 결과" />
        <StatCard label="실패" value={items.filter((item) => item.status === "failed").length} hint="재시도 필요" />
      </section>
      <h3 className="font-display text-2xl font-semibold text-white">최종 결과물</h3>
      <ExportListTable items={items} />
    </div>
  );
}
