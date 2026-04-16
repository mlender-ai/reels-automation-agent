import { Outlet } from "react-router-dom";

import { Sidebar } from "../components/Sidebar";
import { Topbar } from "../components/Topbar";

export function AppShell() {
  return (
    <div className="min-h-screen bg-app text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.12),_transparent_24%),radial-gradient(circle_at_top,_rgba(34,211,238,0.14),_transparent_32%),linear-gradient(180deg,_#020617,_#070b15_55%,_#020617)]" />
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 px-4 py-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

