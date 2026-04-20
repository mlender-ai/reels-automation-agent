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
      pushToast({ tone: "error", title: "Dashboard failed to load", description: message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [pushToast]);

  if (loading) {
    return <LoadingState label="Loading creator dashboard..." />;
  }

  if (!summary) {
    return (
      <ErrorState
        title="Dashboard unavailable"
        description={errorMessage || "The API did not return dashboard data. Make sure the backend server is running and reachable."}
        actionLabel="Retry dashboard"
        onAction={() => void load()}
      />
    );
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Projects" value={summary.total_projects} hint="Active library" />
        <StatCard label="Pending Review" value={summary.pending_review_count} hint="Needs decision" />
        <StatCard label="Approved Clips" value={summary.approved_count} hint="Ready to export" />
        <StatCard label="Completed Exports" value={summary.export_count} hint="Final assets" />
      </section>

      {!summary.total_projects ? (
        <EmptyState
          title="Create the first local project"
          description="Start by uploading a long-form video from your machine. After that you can transcribe, generate clip candidates, review, export, and queue a mock publish."
          actionLabel="Create project"
          actionHref="/projects/new"
        />
      ) : null}

      {systemStatus ? <SystemStatusCard status={systemStatus} /> : null}

      <section className="grid gap-8 xl:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl font-semibold text-white">Recent Projects</h3>
            <Link to="/projects/new" className="text-sm font-medium text-cyan-200 hover:text-cyan-100">
              New project
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
            <h3 className="font-display text-xl font-semibold text-white">Pending Review</h3>
            <span className="text-sm text-slate-400">{summary.pending_review_clips.length} surfaced now</span>
          </div>
          {summary.pending_review_clips.length ? (
            <div className="grid gap-4">
              {summary.pending_review_clips.map((clip) => (
                <ClipCard key={clip.id} clip={clip} compact />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No clips waiting"
              description="Once you generate clip candidates, the strongest highlights will appear here for fast triage."
            />
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold text-white">Recent Exports</h3>
          <Link to="/exports" className="text-sm font-medium text-cyan-200 hover:text-cyan-100">
            View all exports
          </Link>
        </div>
        {summary.recent_exports.length ? (
          <ExportListTable items={summary.recent_exports} />
        ) : (
          <EmptyState title="No exports yet" description="Approve a clip and run export to generate the first vertical MP4 output." />
        )}
      </section>
    </div>
  );
}
