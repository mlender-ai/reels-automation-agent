import { Routes, Route, Navigate } from "react-router-dom";

import { AppShell } from "./layouts/AppShell";
import { CandidateClipsPage } from "./pages/CandidateClipsPage";
import { ClipReviewPage } from "./pages/ClipReviewPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ExportsPage } from "./pages/ExportsPage";
import { NewProjectPage } from "./pages/NewProjectPage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { PublishQueuePage } from "./pages/PublishQueuePage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
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

