import { Film, Link2, UploadCloud } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../api";
import { useToast } from "../hooks/useToast";
import { ACCEPTED_VIDEO_INPUT, MAX_UPLOAD_SIZE_MB, validateSelectedVideo } from "../lib/uploadValidation";

type SourceMode = "upload" | "youtube";
type Stage = "idle" | "creating" | "uploading" | "importing";

const YOUTUBE_HOST_PATTERN = /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be)\//i;

function validateYouTubeUrl(url: string): string | null {
  const normalized = url.trim();
  if (!normalized) {
    return "YouTube 링크를 입력해 주세요.";
  }
  if (!YOUTUBE_HOST_PATTERN.test(normalized)) {
    return "YouTube watch 링크 또는 Shorts 링크를 입력해 주세요.";
  }
  return null;
}

export function NewProjectPage() {
  const [title, setTitle] = useState("");
  const [sourceMode, setSourceMode] = useState<SourceMode>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [submissionNotice, setSubmissionNotice] = useState<{ tone: "error" | "success"; title: string; description: string } | null>(null);
  const navigate = useNavigate();
  const { pushToast } = useToast();

  const fileError = useMemo(() => (file ? validateSelectedVideo(file) : null), [file]);
  const youtubeUrlError = useMemo(() => (sourceMode === "youtube" ? validateYouTubeUrl(youtubeUrl) : null), [sourceMode, youtubeUrl]);
  const canSubmit = Boolean(
    title.trim() &&
      !submitting &&
      ((sourceMode === "upload" && file && !fileError) || (sourceMode === "youtube" && youtubeUrl.trim() && !youtubeUrlError)),
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      const message = "프로젝트 제목을 먼저 입력해 주세요.";
      setSubmissionNotice({
        tone: "error",
        title: "프로젝트 설정이 아직 부족합니다",
        description: message,
      });
      pushToast({
        tone: "error",
        title: "프로젝트 설정이 아직 부족합니다",
        description: message,
      });
      return;
    }

    if (sourceMode === "upload") {
      if (!file) {
        const message = "로컬 영상 파일을 먼저 선택해 주세요.";
        setSubmissionNotice({
          tone: "error",
          title: "프로젝트 설정이 아직 부족합니다",
          description: message,
        });
        pushToast({
          tone: "error",
          title: "프로젝트 설정이 아직 부족합니다",
          description: message,
        });
        return;
      }
      if (fileError) {
        setSubmissionNotice({
          tone: "error",
          title: "올바른 영상 파일을 선택해 주세요",
          description: fileError,
        });
        pushToast({
          tone: "error",
          title: "올바른 영상 파일을 선택해 주세요",
          description: fileError,
        });
        return;
      }
    } else if (youtubeUrlError) {
      setSubmissionNotice({
        tone: "error",
        title: "올바른 링크를 입력해 주세요",
        description: youtubeUrlError,
      });
      pushToast({
        tone: "error",
        title: "올바른 링크를 입력해 주세요",
        description: youtubeUrlError,
      });
      return;
    }

    let failedStage: Exclude<Stage, "idle"> = "creating";

    try {
      setSubmitting(true);
      setSubmissionNotice(null);
      setStage("creating");
      const project = await api.createProject({ title: title.trim(), source_type: sourceMode });

      if (sourceMode === "upload" && file) {
        failedStage = "uploading";
        setStage("uploading");
        await api.uploadProjectVideo(project.id, file);
      } else {
        failedStage = "importing";
        setStage("importing");
        await api.ingestProjectYouTube(project.id, youtubeUrl.trim());
      }

      const successDescription =
        sourceMode === "upload"
          ? "원본 파일이 로컬에 저장되었습니다. 다음 단계는 프로젝트 상세에서 자막 추출입니다."
          : "YouTube 링크를 로컬 프로젝트 소스로 가져왔습니다. 다음 단계는 프로젝트 상세에서 자막 추출입니다.";

      setSubmissionNotice({
        tone: "success",
        title: "프로젝트가 생성되었습니다",
        description: successDescription,
      });
      pushToast({
        tone: "success",
        title: "프로젝트가 생성되었습니다",
        description: sourceMode === "upload" ? "원본 파일이 저장되었습니다. 다음 단계는 자막 추출입니다." : "링크 가져오기가 완료되었습니다. 다음 단계는 자막 추출입니다.",
      });
      navigate(`/projects/${project.id}`);
    } catch (error) {
      const noticeTitle =
        failedStage === "uploading"
          ? "영상 업로드에 실패했습니다"
          : failedStage === "importing"
            ? "YouTube 링크 가져오기에 실패했습니다"
            : "프로젝트 생성에 실패했습니다";
      setSubmissionNotice({
        tone: "error",
        title: noticeTitle,
        description: (error as Error).message,
      });
      pushToast({
        tone: "error",
        title: noticeTitle,
        description: (error as Error).message,
      });
    } finally {
      setSubmitting(false);
      setStage("idle");
    }
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[1.1fr,0.9fr]">
      <form onSubmit={handleSubmit} className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-panel">
        <p className="text-xs uppercase tracking-[0.25em] text-cyan-200/70">새 워크플로우</p>
        <h3 className="mt-3 font-display text-3xl font-semibold text-white">원본 영상을 바로 소스로 연결하세요</h3>
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
          로컬 파일을 직접 올리거나 YouTube 링크를 붙여 넣으면, 원본을 로컬 프로젝트 폴더로 가져온 뒤 같은 숏폼 파이프라인으로 이어집니다.
        </p>

        <div className="mt-6 inline-flex rounded-2xl border border-white/10 bg-black/20 p-1">
          <button
            type="button"
            onClick={() => setSourceMode("upload")}
            className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
              sourceMode === "upload" ? "bg-cyan-300 text-slate-950" : "text-slate-300 hover:text-white"
            }`}
          >
            로컬 업로드
          </button>
          <button
            type="button"
            onClick={() => setSourceMode("youtube")}
            className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
              sourceMode === "youtube" ? "bg-cyan-300 text-slate-950" : "text-slate-300 hover:text-white"
            }`}
          >
            YouTube 링크
          </button>
        </div>

        <div className="mt-8 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">프로젝트 제목</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="예시: 마이클 타이슨 경기 분석 숏츠"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40"
            />
          </label>

          {sourceMode === "upload" ? (
            <label className="block rounded-[28px] border border-dashed border-white/15 bg-black/20 p-6 transition hover:border-cyan-300/35">
              <input
                type="file"
                accept={ACCEPTED_VIDEO_INPUT}
                className="hidden"
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] ?? null;
                  setFile(nextFile);
                }}
              />
              <div className="flex flex-col items-center justify-center text-center">
                <UploadCloud className="h-12 w-12 text-cyan-300" />
                <p className="mt-4 text-lg font-semibold text-white">{file ? file.name : "원본 영상을 선택하세요"}</p>
                <p className="mt-2 text-sm text-slate-400">
                  MP4를 권장합니다. MOV, M4V, WebM, MKV도 가능합니다. 업로드는 {MAX_UPLOAD_SIZE_MB}MB 이하로 유지해 주세요.
                </p>
                {file ? <p className="mt-3 text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(1)} MB 선택됨</p> : null}
              </div>
            </label>
          ) : (
            <div className="rounded-[28px] border border-white/15 bg-black/20 p-6">
              <div className="flex items-center gap-3 text-cyan-300">
                <Link2 className="h-5 w-5" />
                <p className="text-sm font-medium">YouTube watch 또는 Shorts 링크</p>
              </div>
              <textarea
                value={youtubeUrl}
                onChange={(event) => setYoutubeUrl(event.target.value)}
                placeholder="예시: https://www.youtube.com/watch?v=... 또는 https://www.youtube.com/shorts/..."
                className="mt-4 min-h-28 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition focus:border-cyan-300/40"
              />
              <p className="mt-3 text-xs leading-5 text-slate-500">
                링크를 입력하면 원본을 먼저 로컬 프로젝트 폴더로 가져온 뒤, 자막 추출과 후보 생성 파이프라인으로 이어집니다.
              </p>
            </div>
          )}

          {sourceMode === "upload" && fileError ? (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{fileError}</div>
          ) : null}

          {sourceMode === "youtube" && youtubeUrl.trim() && youtubeUrlError ? (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{youtubeUrlError}</div>
          ) : null}

          {submitting ? (
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100">
              {stage === "creating"
                ? "프로젝트 레코드를 만드는 중..."
                : stage === "uploading"
                  ? "로컬 프로젝트 폴더로 원본 영상을 업로드하는 중..."
                  : "YouTube 링크를 로컬 프로젝트 소스로 가져오는 중..."}
            </div>
          ) : null}

          {submissionNotice ? (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                submissionNotice.tone === "error"
                  ? "border-rose-400/20 bg-rose-400/10 text-rose-100"
                  : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
              }`}
            >
              <p className="font-semibold">{submissionNotice.title}</p>
              <p className="mt-2 leading-6 text-white/85">{submissionNotice.description}</p>
            </div>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-8 inline-flex items-center justify-center rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "프로젝트 생성 중..." : "프로젝트 만들기"}
        </button>
      </form>

      <div className="space-y-6">
        <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-panel">
          <div className="flex items-center gap-3">
            <Film className="h-5 w-5 text-emerald-300" />
            <p className="font-medium text-white">다음 단계</p>
          </div>
          <div className="mt-5 space-y-4 text-sm leading-6 text-slate-300">
            <p>1. SQLite에 프로젝트가 생성되고 로컬 폴더 구조가 준비됩니다.</p>
            <p>2. 소스는 `backend/data/projects/{'{project_id}'}/source/` 아래에 저장됩니다.</p>
            <p>3. 프로젝트 상세에서 자막 추출, 후보 생성, 승인, 내보내기, 게시 큐를 실행할 수 있습니다.</p>
          </div>
        </div>

        <div className="rounded-[32px] border border-amber-300/15 bg-amber-300/5 p-6">
          <p className="text-sm font-semibold text-amber-100">사용 범위 안내</p>
          <p className="mt-3 text-sm leading-6 text-amber-50/80">
            로컬 파일 또는 직접 입력한 YouTube 링크를 소스로 가져옵니다. 실제 운영에서는 본인이 사용할 수 있는 소스만 연결하는 흐름을 권장합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
