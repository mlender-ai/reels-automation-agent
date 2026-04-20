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
        title: "Project setup is incomplete",
        description: "Add a project title and choose one local video file before continuing.",
      });
      pushToast({
        tone: "error",
        title: "Project setup is incomplete",
        description: "Add a project title and choose one local video file before continuing.",
      });
      return;
    }
    if (fileError) {
      setSubmissionNotice({
        tone: "error",
        title: "Choose a valid video file",
        description: fileError,
      });
      pushToast({
        tone: "error",
        title: "Choose a valid video file",
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
        title: "Project created",
        description: "The source file is stored locally. Next step is transcription from the project detail page.",
      });
      pushToast({
        tone: "success",
        title: "Project created",
        description: "The source file is stored locally. Next step is transcription.",
      });
      navigate(`/projects/${project.id}`);
    } catch (error) {
      const noticeTitle = failedStage === "uploading" ? "Video upload failed" : "Project creation failed";
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
        <p className="text-xs uppercase tracking-[0.25em] text-cyan-200/70">New Workflow</p>
        <h3 className="mt-3 font-display text-3xl font-semibold text-white">Upload a source video from disk</h3>
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
          This MVP never downloads from external platforms. It only processes videos that you explicitly upload from your local machine.
        </p>

        <div className="mt-8 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">Project title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Example: Podcast episode 18 highlights"
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
              <p className="mt-4 text-lg font-semibold text-white">{file ? file.name : "Choose a source video"}</p>
              <p className="mt-2 text-sm text-slate-400">
                MP4 works best. MOV, M4V, WebM, and MKV are also allowed. Keep uploads under {MAX_UPLOAD_SIZE_MB} MB.
              </p>
              {file ? <p className="mt-3 text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(1)} MB selected</p> : null}
            </div>
          </label>

          {fileError ? (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{fileError}</div>
          ) : null}

          {submitting ? (
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100">
              {stage === "creating" ? "Creating project record..." : "Uploading source video into the local project folder..."}
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
          {submitting ? "Creating project..." : "Create Project"}
        </button>
      </form>

      <div className="space-y-6">
        <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-panel">
          <div className="flex items-center gap-3">
            <Film className="h-5 w-5 text-emerald-300" />
            <p className="font-medium text-white">What happens next</p>
          </div>
          <div className="mt-5 space-y-4 text-sm leading-6 text-slate-300">
            <p>1. The project is created in SQLite and local project folders are prepared.</p>
            <p>2. Your uploaded file is copied into `backend/data/projects/{'{project_id}'}/source/`.</p>
            <p>3. From the project detail screen you can run transcription, generate clips, approve, export, and queue publish jobs.</p>
          </div>
        </div>

        <div className="rounded-[32px] border border-amber-300/15 bg-amber-300/5 p-6">
          <p className="text-sm font-semibold text-amber-100">Important scope guard</p>
          <p className="mt-3 text-sm leading-6 text-amber-50/80">
            No URL downloads, no account auth wall, no cloud storage. This workspace is intentionally local-first and approval-driven.
          </p>
        </div>
      </div>
    </div>
  );
}
