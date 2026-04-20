import { Routes, Route, Navigate } from "react-router-dom";

import { AppShell } from "./layouts/AppShell";
import { CandidateClipsPage } from "./pages/CandidateClipsPage";
import { ClipReviewPage } from "./pages/ClipReviewPage";
import { ConceptLabPage } from "./pages/ConceptLabPage";
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
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/70">로컬 우선 크리에이터 운영</p>
            <h1 className="mt-3 font-display text-3xl font-semibold text-white xl:text-4xl">reels-automation-agent</h1>
            <p className="mt-3 text-base leading-7 text-slate-300">
              긴 영상을 업로드하고, 로컬에서 자막을 만들고, 숏폼 후보를 생성하고, 강한 장면을 승인한 뒤 세로형 MP4로 내보내며,
              QA/PO/PM/CTO AI 운영 루프까지 한 레포 안에서 함께 돌리는 워크스페이스입니다.
            </p>
          </div>
          <div className="grid gap-3 rounded-3xl border border-cyan-300/15 bg-slate-950/65 p-4 text-sm text-slate-300 xl:min-w-[320px]">
            <p className="font-medium text-white">AI 시스템 안내</p>
            <p>운영 문서는 `README.md`, `docs/ai-system/`, `.github/prompts/`, `.github/workflows/`에 정리되어 있습니다.</p>
            <p className="text-slate-400">먼저 프로젝트를 업로드하고, 이후 `reports/` 아래 자동화 리포트를 확인하면 됩니다.</p>
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
        <Route path="/concepts" element={<ConceptLabPage />} />
        <Route path="/publish" element={<PublishQueuePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
