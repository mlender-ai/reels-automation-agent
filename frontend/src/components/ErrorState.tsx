type ErrorStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function ErrorState({ title, description, actionLabel, onAction }: ErrorStateProps) {
  return (
    <div className="rounded-3xl border border-rose-400/20 bg-rose-400/10 px-6 py-10 text-center">
      <p className="font-display text-2xl font-semibold text-white">{title}</p>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-rose-50/85">{description}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-6 rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/15"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
