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
      pushToast({ tone: "error", title: "Exports failed to load", description: message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [pushToast]);

  if (loading) return <LoadingState label="Loading exports..." />;
  if (errorMessage && !items.length) {
    return <ErrorState title="Exports unavailable" description={errorMessage} actionLabel="Retry exports" onAction={() => void load()} />;
  }
  if (!items.length) {
    return <EmptyState title="No exports yet" description="Approve a clip and run export to create the first vertical MP4 asset." />;
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Exports" value={items.length} hint="Total jobs" />
        <StatCard label="Completed" value={items.filter((item) => item.status === "completed").length} hint="Playable assets" />
        <StatCard label="Failed" value={items.filter((item) => item.status === "failed").length} hint="Needs retry" />
      </section>
      <h3 className="font-display text-2xl font-semibold text-white">Final Outputs</h3>
      <ExportListTable items={items} />
    </div>
  );
}
