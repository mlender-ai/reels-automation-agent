import { BarChart3, FolderPlus, FolderKanban, Clapperboard, Palette, Send } from "lucide-react";
import { NavLink } from "react-router-dom";

const navItems = [
  { label: "대시보드", to: "/", icon: BarChart3 },
  { label: "새 프로젝트", to: "/projects/new", icon: FolderPlus },
  { label: "컨셉 비교", to: "/concepts", icon: Palette },
  { label: "내보내기", to: "/exports", icon: Clapperboard },
  { label: "게시 큐", to: "/publish", icon: Send },
];

export function Sidebar() {
  return (
    <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-slate-950/70 px-5 py-6 lg:block">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-panel">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">AI 숏폼 운영</p>
        <h1 className="mt-3 font-display text-2xl font-semibold text-white">릴스 자동화 에이전트</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          긴 영상 하나를 검토 가능한 숏폼 후보로 만들고, 세로형으로 내보낸 뒤 멀티 플랫폼 게시 준비까지 로컬 대시보드에서 관리합니다.
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
          <p className="text-sm font-medium text-emerald-100">자동화 루프</p>
        </div>
        <p className="mt-3 text-sm leading-6 text-emerald-50/75">
          로컬 업로드, 자막, 클립 점수화, 승인, 내보내기, 모의 게시, AI 팀 검토가 같은 레포 안에서 함께 돌아갑니다.
        </p>
      </div>
    </aside>
  );
}
