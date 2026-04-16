type LoadingStateProps = {
  label?: string;
};

export function LoadingState({ label = "Loading..." }: LoadingStateProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center">
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-cyan-300/40 border-t-cyan-300" />
      <p className="mt-4 text-sm text-slate-400">{label}</p>
    </div>
  );
}

