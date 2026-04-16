import { CalendarRange, Plus } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const titles: Record<string, { title: string; description: string }> = {
  "/": {
    title: "Creator Dashboard",
    description: "Track approvals, exports, and the next shortlist that needs review.",
  },
  "/projects/new": {
    title: "New Project",
    description: "Start a local-first shortform workflow from a video file on disk.",
  },
  "/exports": {
    title: "Exports",
    description: "Review final MP4 outputs, subtitle assets, and generated thumbnails.",
  },
  "/publish": {
    title: "Publish Queue",
    description: "Queue exported clips to mock platform adapters and monitor posting state.",
  },
};

function getRouteMeta(pathname: string) {
  if (pathname.startsWith("/projects/") && pathname.endsWith("/clips")) {
    return {
      title: "Candidate Clips",
      description: "Sort through AI-ranked moments and send the strongest ones into review.",
    };
  }
  if (pathname.startsWith("/projects/")) {
    return {
      title: "Project Detail",
      description: "Drive the project from source upload to transcript and clip generation.",
    };
  }
  if (pathname.startsWith("/clips/")) {
    return {
      title: "Clip Review",
      description: "Tune timing, metadata, subtitles, approval state, export, and publish readiness.",
    };
  }
  return titles[pathname] ?? titles["/"];
}

export function Topbar() {
  const location = useLocation();
  const meta = getRouteMeta(location.pathname);

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/65 px-4 py-4 backdrop-blur lg:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-200/65">Automation Workspace</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-white">{meta.title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">{meta.description}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300 md:flex">
            <CalendarRange className="h-4 w-4 text-cyan-300" />
            {new Date().toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
          </div>
          <Link
            to="/projects/new"
            className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
          >
            <Plus className="h-4 w-4" />
            New Project
          </Link>
        </div>
      </div>
    </header>
  );
}
