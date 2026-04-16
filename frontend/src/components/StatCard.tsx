type StatCardProps = {
  label: string;
  value: number;
  hint: string;
};

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-panel">
      <p className="text-sm text-slate-400">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="font-display text-4xl font-semibold text-white">{value}</p>
        <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">{hint}</span>
      </div>
    </div>
  );
}

