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
      pushToast({ tone: "error", title: "Candidate clips failed to load", description: message });
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
        title: "Clip approved",
        description: "This candidate is now ready for export and can move into the next production step.",
      });
      pushToast({ tone: "success", title: "Clip approved", description: "This candidate is now ready for export." });
    } catch (error) {
      const message = (error as Error).message;
      setActionNotice({ tone: "error", title: "Approval failed", description: `${message} Retry when you are ready.` });
      pushToast({ tone: "error", title: "Approval failed", description: message });
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
        title: "Clip rejected",
        description: "It stays visible for traceability, but it will no longer appear export-ready.",
      });
      pushToast({ tone: "info", title: "Clip rejected", description: "It stays visible but marked as rejected for traceability." });
    } catch (error) {
      const message = (error as Error).message;
      setActionNotice({ tone: "error", title: "Reject failed", description: `${message} Exported clips must stay tracked, so edit and re-export instead.` });
      pushToast({ tone: "error", title: "Reject failed", description: message });
    } finally {
      setRejectingId(null);
      setBusyClipId(null);
    }
  }

  if (loading) return <LoadingState label="Loading candidate clips..." />;
  if (!project) {
    if (pageError) {
      return <ErrorState title="Candidate queue unavailable" description={pageError} actionLabel="Retry queue" onAction={() => void load()} />;
    }
    return <EmptyState title="Project missing" description="This project could not be found." />;
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 rounded-[32px] border border-white/10 bg-white/[0.04] p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Review Queue</p>
          <h3 className="mt-3 font-display text-3xl font-semibold text-white">{project.title}</h3>
          <p className="mt-2 text-sm text-slate-400">
            {clips.length} candidates · {clips.filter((clip) => clip.status === "pending").length} pending ·{" "}
            {clips.filter((clip) => clip.status === "approved" || clip.status === "exported").length} approved/exported
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to={`/projects/${project.id}`}
            className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/5"
          >
            Back to project
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
          title="No candidates yet"
          description="Generate clip candidates from the project detail page after transcription is complete."
          actionLabel="Open project"
          actionHref={`/projects/${project.id}`}
        />
      )}

      <ConfirmModal
        open={rejectingId != null}
        title="Reject clip candidate?"
        description="This keeps the candidate in the review log but marks it as rejected so it does not look ready for export."
        confirmLabel="Reject clip"
        onConfirm={confirmReject}
        onClose={() => setRejectingId(null)}
      />
    </div>
  );
}
