import { CalendarRange, Plus } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const titles: Record<string, { title: string; description: string }> = {
  "/": {
    title: "크리에이터 대시보드",
    description: "승인 현황, 내보내기 결과, 다음 검토 대상을 한눈에 확인합니다.",
  },
  "/projects/new": {
    title: "새 프로젝트",
    description: "로컬 영상 파일로 숏폼 제작 워크플로우를 시작합니다.",
  },
  "/exports": {
    title: "내보내기",
    description: "완성된 MP4, 자막 자산, 썸네일 결과를 확인합니다.",
  },
  "/publish": {
    title: "게시 큐",
    description: "내보낸 클립을 모의 플랫폼 어댑터에 넣고 상태를 확인합니다.",
  },
};

function getRouteMeta(pathname: string) {
  if (pathname.startsWith("/projects/") && pathname.endsWith("/clips")) {
    return {
      title: "클립 후보",
      description: "AI가 점수화한 장면을 검토하고 유망한 후보를 다음 단계로 넘깁니다.",
    };
  }
  if (pathname.startsWith("/projects/")) {
    return {
      title: "프로젝트 상세",
      description: "원본 업로드부터 자막, 후보 생성까지 프로젝트 흐름을 관리합니다.",
    };
  }
  if (pathname.startsWith("/clips/")) {
    return {
      title: "클립 검토",
      description: "타이밍, 메타데이터, 자막, 승인 상태, 내보내기 준비도를 조정합니다.",
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
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-200/65">자동화 워크스페이스</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-white">{meta.title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">{meta.description}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300 md:flex">
            <CalendarRange className="h-4 w-4 text-cyan-300" />
            {new Date().toLocaleDateString("ko-KR", { weekday: "short", month: "short", day: "numeric" })}
          </div>
          <Link
            to="/projects/new"
            className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
          >
            <Plus className="h-4 w-4" />
            새 프로젝트
          </Link>
        </div>
      </div>
    </header>
  );
}
