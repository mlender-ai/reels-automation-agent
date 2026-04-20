import { ExternalLink, Film, Sparkles } from "lucide-react";

import { EmptyState } from "../components/EmptyState";
import { resolveMediaUrl } from "../lib/media";

type ConceptPreview = {
  slug: string;
  label: string;
  title: string;
  summary: string;
  tone: string;
  hook: string;
  titleSystem: string;
  captionSystem: string;
  colorNote: string;
  outputPath: string;
  thumbnailPath: string;
};

const projectId = 4;

const conceptPreviews: ConceptPreview[] = [
  {
    slug: "legend",
    label: "레전드형",
    title: "타이밍 하나가 분위기를 바꾼다",
    summary: "하이라이트 찬양형 톤으로, 가장 상업적인 스포츠 숏츠 감도에 가깝게 잡은 버전입니다.",
    tone: "영웅화, 찬양, 임팩트 강조",
    hook: "짧은 카피로 장면의 서사를 압축합니다.",
    titleSystem: "좌측 정렬 브랜드 카드 + 골드 포인트 라인",
    captionSystem: "하단 글래스 패널 + 낮은 대비 포인트 라인",
    colorNote: "블랙 기반에 골드 포인트만 사용",
    outputPath: `/files/projects/${projectId}/exports/legend-combat-short.mp4`,
    thumbnailPath: `/files/projects/${projectId}/exports/legend-combat-short.jpg`,
  },
  {
    slug: "finish",
    label: "피니시형",
    title: "가드가 들리는 순간 끝까지 몰아친다",
    summary: "타격 임팩트와 마무리 감정을 가장 세게 가져가는 버전입니다.",
    tone: "압박, 속도, 마무리 집중",
    hook: "첫 1초 안에 결론이 느껴지도록 설계했습니다.",
    titleSystem: "상단 어두운 카드 + 레드 포인트 라인",
    captionSystem: "짧은 문장 위주 하단 집중형",
    colorNote: "블랙 기반 + 레드 포인트만 사용",
    outputPath: `/files/projects/${projectId}/exports/finish-combat-short.mp4`,
    thumbnailPath: `/files/projects/${projectId}/exports/finish-combat-short.jpg`,
  },
  {
    slug: "analysis",
    label: "분석형",
    title: "마지막 펀치보다 앞동작이 더 중요하다",
    summary: "격투기 분석 채널처럼 설명 신뢰도를 높이는 버전입니다.",
    tone: "전술, 브레이크다운, 전문가 톤",
    hook: "감정보다 해설에 반응하는 시청자를 겨냥합니다.",
    titleSystem: "상단 카드 + 차가운 블루 포인트",
    captionSystem: "포인트 번호형 카피",
    colorNote: "블랙 기반 + 아이스 블루 포인트",
    outputPath: `/files/projects/${projectId}/exports/analysis-combat-short.mp4`,
    thumbnailPath: `/files/projects/${projectId}/exports/analysis-combat-short.jpg`,
  },
  {
    slug: "editorial",
    label: "에디토리얼형",
    title: "한 장면만으로도 충분히 기억에 남는다",
    summary: "장면의 잔상과 분위기를 살리는 감도 높은 에디토리얼 컷입니다.",
    tone: "무드, 잔상, 절제된 카피",
    hook: "정보량을 줄이고 기억에 남는 문장만 남깁니다.",
    titleSystem: "샴페인 포인트가 들어간 무드형 브랜드 카드",
    captionSystem: "낮은 알파 카드 + 여백 강조",
    colorNote: "블랙 기반 + 샴페인 포인트",
    outputPath: `/files/projects/${projectId}/exports/editorial-combat-short.mp4`,
    thumbnailPath: `/files/projects/${projectId}/exports/editorial-combat-short.jpg`,
  },
  {
    slug: "coach",
    label: "코치 노트형",
    title: "코치는 마지막보다 준비 동작을 먼저 본다",
    summary: "스포츠 인사이트 계정처럼 포인트를 차분하게 짚어주는 설명형 포맷입니다.",
    tone: "인사이트, 학습, 신뢰감",
    hook: "정보를 주는 콘텐츠처럼 보이게 설계했습니다.",
    titleSystem: "상단 카드 + 라임 포인트",
    captionSystem: "체크리스트 느낌의 단계형 자막",
    colorNote: "블랙 기반 + 라임 포인트",
    outputPath: `/files/projects/${projectId}/exports/coach-combat-short.mp4`,
    thumbnailPath: `/files/projects/${projectId}/exports/coach-combat-short.jpg`,
  },
];

export function ConceptLabPage() {
  if (!conceptPreviews.length) {
    return <EmptyState title="아직 준비된 컨셉이 없습니다" description="컨셉 생성 작업을 실행하면 이 화면에서 비교할 수 있습니다." />;
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-panel">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/70">컨셉 실험실</p>
            <h2 className="mt-3 font-display text-3xl font-semibold text-white">격투기 숏츠 컨셉 비교</h2>
            <p className="mt-3 text-base leading-7 text-slate-300">
              같은 실제 원본을 기준으로 컨셉만 달리한 결과물입니다. 썸네일, 영상, 제목 톤, 자막 시스템을 한 화면에서 비교하면서
              다음 기본 템플릿을 고를 수 있게 구성했습니다.
            </p>
          </div>
          <div className="grid gap-3 rounded-3xl border border-cyan-300/15 bg-slate-950/65 p-4 text-sm text-slate-300 xl:min-w-[320px]">
            <p className="font-medium text-white">비교 포인트</p>
            <p>1. 첫 1초 훅의 세기</p>
            <p>2. 타이틀 카드의 브랜드 감도</p>
            <p>3. 하단 자막이 영상 집중을 방해하는지 여부</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 2xl:grid-cols-2">
        {conceptPreviews.map((concept) => (
          <article key={concept.slug} className="overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.04] shadow-panel">
            <div className="grid gap-0 xl:grid-cols-[0.92fr,1.08fr]">
              <div className="border-b border-white/10 bg-black/40 xl:border-b-0 xl:border-r">
                <div className="mx-auto max-w-[360px] p-5">
                  <div className="overflow-hidden rounded-[30px] border border-white/10 bg-black shadow-panel">
                    <video
                      controls
                      poster={resolveMediaUrl(concept.thumbnailPath)}
                      src={resolveMediaUrl(concept.outputPath)}
                      className="aspect-[9/16] w-full object-cover"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-5 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                      {concept.label}
                    </span>
                    <h3 className="mt-3 font-display text-2xl font-semibold text-white">{concept.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-300">{concept.summary}</p>
                  </div>
                  <Sparkles className="mt-1 h-5 w-5 shrink-0 text-cyan-200" />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">톤</p>
                    <p className="mt-2 text-sm font-medium text-white">{concept.tone}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">훅 의도</p>
                    <p className="mt-2 text-sm font-medium text-white">{concept.hook}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">타이틀 시스템</p>
                    <p className="mt-2 text-sm font-medium text-white">{concept.titleSystem}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">자막 시스템</p>
                    <p className="mt-2 text-sm font-medium text-white">{concept.captionSystem}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center gap-2">
                    <Film className="h-4 w-4 text-slate-300" />
                    <p className="text-sm font-semibold text-white">컬러 전략</p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{concept.colorNote}</p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <a
                    href={resolveMediaUrl(concept.outputPath)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
                  >
                    영상 열기
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <a
                    href={resolveMediaUrl(concept.thumbnailPath)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5"
                  >
                    썸네일 열기
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
