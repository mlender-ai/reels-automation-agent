import { Check, PencilLine, RotateCcw, X } from "lucide-react";
import { Link } from "react-router-dom";

import type { ClipCandidate } from "../types";
import { formatDuration, formatScore, truncate } from "../lib/formatters";
import { StatusBadge } from "./StatusBadge";

type ClipCardProps = {
  clip: ClipCandidate;
  onApprove?: (clipId: number) => void;
  onReject?: (clipId: number) => void;
  onResetReview?: (clipId: number) => void;
  compact?: boolean;
};

export function ClipCard({ clip, onApprove, onReject, onResetReview, compact = false }: ClipCardProps) {
  const primarySignals = (clip.selection_signals ?? []).slice(0, 2);
  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] shadow-panel">
      <Link
        to={`/clips/${clip.id}`}
        className="relative block aspect-[9/12] overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(110,231,249,0.18),_transparent_40%),linear-gradient(180deg,rgba(13,18,33,0.92),rgba(4,7,15,1))] transition hover:brightness-110"
      >
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(7,11,21,0.92)_100%)]" />
        <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-black/45 px-3 py-1 text-xs font-medium text-cyan-100">{formatDuration(clip.duration)}</span>
            <span className="rounded-full bg-cyan-300/15 px-3 py-1 text-xs font-semibold text-cyan-100">점수 {formatScore(clip.score)}</span>
            {clip.content_profile_label ? (
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90">{clip.content_profile_label}</span>
            ) : null}
            {clip.recommended_format ? (
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90">{clip.recommended_format}</span>
            ) : null}
          </div>
          <StatusBadge status={clip.status} />
        </div>
        <div className="absolute inset-x-4 bottom-4">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">훅</p>
          <p className="mt-2 text-sm leading-6 text-white">{truncate(clip.hook_text, compact ? 90 : 110)}</p>
        </div>
      </Link>

      <div className="p-5">
        <Link to={`/clips/${clip.id}`} className="block">
          <h3 className="text-lg font-semibold text-white">{clip.suggested_title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">{truncate(clip.suggested_description, compact ? 105 : 130)}</p>
          {clip.selection_reason ? <p className="mt-3 text-sm leading-6 text-cyan-50/90">{truncate(clip.selection_reason, compact ? 85 : 120)}</p> : null}
        </Link>

        <div className="mt-4 flex flex-wrap gap-2">
          {clip.virality_label ? (
            <span className="rounded-full bg-emerald-400/12 px-3 py-1 text-xs font-medium text-emerald-100">{clip.virality_label}</span>
          ) : null}
          {clip.timeline_label ? (
            <span className="rounded-full bg-amber-300/10 px-3 py-1 text-xs font-medium text-amber-100">{clip.timeline_label}</span>
          ) : null}
          {primarySignals.map((signal) => (
            <span key={signal} className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">
              {truncate(signal, 28)}
            </span>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {clip.suggested_hashtags
            .split(" ")
            .filter(Boolean)
            .slice(0, 4)
            .map((tag) => (
              <span key={tag} className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">
                {tag}
              </span>
            ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            to={`/clips/${clip.id}`}
            className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/15"
          >
            <PencilLine className="h-4 w-4" />
            편집
          </Link>
          {onApprove ? (
            <button
              type="button"
              onClick={() => onApprove(clip.id)}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400/15 px-4 py-2.5 text-sm font-medium text-emerald-200 transition hover:bg-emerald-400/20"
          >
            <Check className="h-4 w-4" />
              승인
            </button>
          ) : null}
          {onReject ? (
            <button
              type="button"
              onClick={() => onReject(clip.id)}
              className="inline-flex items-center gap-2 rounded-2xl bg-rose-400/15 px-4 py-2.5 text-sm font-medium text-rose-200 transition hover:bg-rose-400/20"
            >
              <X className="h-4 w-4" />
              반려
            </button>
          ) : null}
          {onResetReview && clip.status !== "pending" ? (
            <button
              type="button"
              onClick={() => onResetReview(clip.id)}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/5"
            >
              <RotateCcw className="h-4 w-4" />
              되돌리기
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
