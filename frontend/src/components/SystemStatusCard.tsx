import type { SystemStatus } from "../types";
import { StatusBadge } from "./StatusBadge";

type SystemStatusCardProps = {
  status: SystemStatus;
};

export function SystemStatusCard({ status }: SystemStatusCardProps) {
  const allBinariesReady = status.binaries.every((binary) => binary.available);
  const allStorageReady = status.storage.every((item) => item.exists);
  return (
    <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Local System</p>
          <h3 className="mt-3 font-display text-2xl font-semibold text-white">Runtime Readiness</h3>
          <p className="mt-2 text-sm text-slate-400">
            Whisper model <code>{status.whisper_model_size}</code> on <code>{status.whisper_device}</code> with local SQLite storage.
          </p>
        </div>
        <StatusBadge status={allBinariesReady && allStorageReady ? "ready" : "failed"} />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {status.binaries.map((binary) => (
          <div key={binary.name} className="rounded-2xl bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-white">{binary.name}</p>
              <StatusBadge status={binary.available ? "ready" : "failed"} />
            </div>
            <p className="mt-2 text-xs text-slate-500">{binary.resolved_path ?? "Binary not found on PATH"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
