import { Routes, Route, Navigate } from "react-router-dom";

import { AppShell } from "./layouts/AppShell";
import { CandidateClipsPage } from "./pages/CandidateClipsPage";
import { ClipReviewPage } from "./pages/ClipReviewPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ExportsPage } from "./pages/ExportsPage";
import { NewProjectPage } from "./pages/NewProjectPage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { PublishQueuePage } from "./pages/PublishQueuePage";

function HomePage() {
  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-[0_24px_80px_rgba(8,15,32,0.45)] backdrop-blur xl:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/70">Local-First Creator Ops</p>
            <h1 className="mt-3 font-display text-3xl font-semibold text-white xl:text-4xl">reels-automation-agent</h1>
            <p className="mt-3 text-base leading-7 text-slate-300">
              Upload a long-form video, transcribe it locally, generate short clip candidates, approve the strongest moments,
              export vertical MP4s, and run a guarded QA/PO/PM/CTO AI operating loop around the repository itself.
            </p>
          </div>
          <div className="grid gap-3 rounded-3xl border border-cyan-300/15 bg-slate-950/65 p-4 text-sm text-slate-300 xl:min-w-[320px]">
            <p className="font-medium text-white">AI system guide</p>
            <p>Repository docs live in `README.md`, `docs/ai-system/`, `.github/prompts/`, and `.github/workflows/`.</p>
            <p className="text-slate-400">Start with a project upload, then review the automation reports generated under `reports/`.</p>
          </div>
        </div>
      </section>

      <DashboardPage />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/projects/new" element={<NewProjectPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/projects/:projectId/clips" element={<CandidateClipsPage />} />
        <Route path="/clips/:clipId" element={<ClipReviewPage />} />
        <Route path="/exports" element={<ExportsPage />} />
        <Route path="/publish" element={<PublishQueuePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
