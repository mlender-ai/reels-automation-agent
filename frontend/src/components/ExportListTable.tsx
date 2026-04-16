import type { ExportRecord } from "../types";
import { formatDateTime } from "../lib/formatters";
import { resolveMediaUrl } from "../lib/media";
import { StatusBadge } from "./StatusBadge";

type ExportListTableProps = {
  items: ExportRecord[];
};

export function ExportListTable({ items }: ExportListTableProps) {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-black/20 text-slate-400">
            <tr>
              <th className="px-5 py-4 font-medium">Preview</th>
              <th className="px-5 py-4 font-medium">Clip</th>
              <th className="px-5 py-4 font-medium">Status</th>
              <th className="px-5 py-4 font-medium">Created</th>
              <th className="px-5 py-4 font-medium">Output</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-white/5 text-slate-200">
                <td className="px-5 py-4">
                  {item.thumbnail_url && item.output_url ? (
                    <a href={resolveMediaUrl(item.output_url)} target="_blank" rel="noreferrer" className="block">
                      <img
                        src={resolveMediaUrl(item.thumbnail_url)}
                        alt={item.clip_title ?? `Export ${item.id}`}
                        className="h-20 w-12 rounded-2xl border border-white/10 object-cover"
                      />
                    </a>
                  ) : (
                    <div className="flex h-20 w-12 items-center justify-center rounded-2xl border border-dashed border-white/10 text-xs text-slate-500">
                      N/A
                    </div>
                  )}
                </td>
                <td className="px-5 py-4">
                  <div>
                    <p className="font-medium text-white">{item.clip_title ?? `Clip #${item.clip_candidate_id}`}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.output_path ?? "Pending output path"}</p>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <StatusBadge status={item.status} />
                </td>
                <td className="px-5 py-4 text-slate-400">{formatDateTime(item.created_at)}</td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-2">
                    {item.output_url ? (
                      <a
                        href={resolveMediaUrl(item.output_url)}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-2xl bg-cyan-400/10 px-3 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/15"
                      >
                        Open video
                      </a>
                    ) : (
                      <span className="text-slate-500">Not ready</span>
                    )}
                    {item.subtitle_url ? (
                      <a
                        href={resolveMediaUrl(item.subtitle_url)}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-2xl bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/15"
                      >
                        Open subtitles
                      </a>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
