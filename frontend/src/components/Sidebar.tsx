import { BarChart3, FolderPlus, FolderKanban, Clapperboard, Send } from "lucide-react";
import { NavLink } from "react-router-dom";

const navItems = [
  { label: "Dashboard", to: "/", icon: BarChart3 },
  { label: "New Project", to: "/projects/new", icon: FolderPlus },
  { label: "Exports", to: "/exports", icon: Clapperboard },
  { label: "Publish Queue", to: "/publish", icon: Send },
];

export function Sidebar() {
  return (
    <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-slate-950/70 px-5 py-6 lg:block">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-panel">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">AI Creator Ops</p>
        <h1 className="mt-3 font-display text-2xl font-semibold text-white">Reels Automation Agent</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Turn one long-form video into reviewable short clips, export vertical reels, and stage multi-platform publishing from a local dashboard.
        </p>
      </div>

      <nav className="mt-8 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  isActive
                    ? "bg-cyan-400/15 text-white shadow-[inset_0_0_0_1px_rgba(103,232,249,0.25)]"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-10 rounded-3xl border border-emerald-400/10 bg-emerald-400/5 p-5">
        <div className="flex items-center gap-3">
          <FolderKanban className="h-5 w-5 text-emerald-300" />
          <p className="text-sm font-medium text-emerald-100">Automation Loop</p>
        </div>
        <p className="mt-3 text-sm leading-6 text-emerald-50/75">
          Local upload, transcript, clip scoring, approval, export, mock publish, and AI team review running off the same repository.
        </p>
      </div>
    </aside>
  );
}
