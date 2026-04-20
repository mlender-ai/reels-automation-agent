import type { PlatformStatus } from "../types";
import { StatusBadge } from "./StatusBadge";

type PublishPlatformChipProps = {
  platform: PlatformStatus;
};

const platformLabel: Record<string, string> = {
  youtube: "YouTube Shorts",
  instagram: "Instagram Reels",
  tiktok: "TikTok",
};

export function PublishPlatformChip({ platform }: PublishPlatformChipProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">어댑터</p>
          <h3 className="mt-2 text-lg font-semibold text-white">{platformLabel[platform.platform] ?? platform.platform}</h3>
          <p className="mt-2 text-sm text-slate-400">{platform.account_label}</p>
        </div>
        <StatusBadge status={platform.status} />
      </div>
    </div>
  );
}
