import { Film, UploadCloud } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../api";
import { useToast } from "../hooks/useToast";
import { ACCEPTED_VIDEO_INPUT, MAX_UPLOAD_SIZE_MB, validateSelectedVideo } from "../lib/uploadValidation";

export function NewProjectPage() {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<"idle" | "creating" | "uploading">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [submissionNotice, setSubmissionNotice] = useState<{ tone: "error" | "success"; title: string; description: string } | null>(null);
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const fileError = useMemo(() => (file ? validateSelectedVideo(file) : null), [file]);
  const canSubmit = Boolean(title.trim() && file && !fileError && !submitting);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !file) {
      setSubmissionNotice({
        tone: "error",
        title: "프로젝트 설정이 아직 부족합니다",
        description: "프로젝트 제목과 로컬 영상 파일을 먼저 선택해 주세요.",
      });
      pushToast({
        tone: "error",
        title: "프로젝트 설정이 아직 부족합니다",
        description: "프로젝트 제목과 로컬 영상 파일을 먼저 선택해 주세요.",
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

    let failedStage: "creating" | "uploading" = "creating";

    try {
      setSubmitting(true);
      setSubmissionNotice(null);
      setStage("creating");
      const project = await api.createProject({ title: title.trim(), source_type: "upload" });
      failedStage = "uploading";
      setStage("uploading");
      await api.uploadProjectVideo(project.id, file);
      setSubmissionNotice({
        tone: "success",
        title: "프로젝트가 생성되었습니다",
        description: "원본 파일이 로컬에 저장되었습니다. 다음 단계는 프로젝트 상세에서 자막 추출입니다.",
      });
      pushToast({
        tone: "success",
        title: "프로젝트가 생성되었습니다",
        description: "원본 파일이 로컬에 저장되었습니다. 다음 단계는 자막 추출입니다.",
      });
      navigate(`/projects/${project.id}`);
    } catch (error) {
      const noticeTitle = failedStage === "uploading" ? "영상 업로드에 실패했습니다" : "프로젝트 생성에 실패했습니다";
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
        <h3 className="mt-3 font-display text-3xl font-semibold text-white">로컬 원본 영상을 업로드하세요</h3>
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
          이 MVP는 외부 플랫폼에서 영상을 다운로드하지 않습니다. 내 컴퓨터에서 직접 업로드한 영상만 처리합니다.
        </p>

        <div className="mt-8 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">프로젝트 제목</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="예시: 격투기 해설 영상 하이라이트"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40"
            />
          </label>

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

          {fileError ? (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{fileError}</div>
          ) : null}

          {submitting ? (
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100">
              {stage === "creating" ? "프로젝트 레코드를 만드는 중..." : "로컬 프로젝트 폴더로 원본 영상을 업로드하는 중..."}
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
            <p>2. 업로드한 파일은 `backend/data/projects/{'{project_id}'}/source/` 아래로 복사됩니다.</p>
            <p>3. 프로젝트 상세에서 자막 추출, 후보 생성, 승인, 내보내기, 게시 큐를 실행할 수 있습니다.</p>
          </div>
        </div>

        <div className="rounded-[32px] border border-amber-300/15 bg-amber-300/5 p-6">
          <p className="text-sm font-semibold text-amber-100">중요한 범위 제한</p>
          <p className="mt-3 text-sm leading-6 text-amber-50/80">
            URL 다운로드 없음, 계정 인증 강제 없음, 클라우드 저장소 없음. 이 워크스페이스는 의도적으로 로컬 우선, 승인 중심으로 설계되어 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
