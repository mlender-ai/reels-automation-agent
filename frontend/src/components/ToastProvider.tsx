import { createContext, useCallback, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";

type ToastTone = "success" | "error" | "info";

type Toast = {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
};

type ToastContextValue = {
  pushToast: (toast: Omit<Toast, "id">) => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);

const toneStyles: Record<ToastTone, string> = {
  success: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
  error: "border-rose-400/30 bg-rose-400/10 text-rose-100",
  info: "border-cyan-400/30 bg-cyan-400/10 text-cyan-100",
};

const toneIcon: Record<ToastTone, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((toast: Omit<Toast, "id">) => {
    setToasts((current) => [...current, { ...toast, id: Date.now() + Math.round(Math.random() * 1000) }]);
  }, []);

  useEffect(() => {
    if (!toasts.length) return undefined;
    const timer = window.setTimeout(() => {
      setToasts((current) => current.slice(1));
    }, 3800);
    return () => window.clearTimeout(timer);
  }, [toasts]);

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-6 top-6 z-50 flex w-full max-w-sm flex-col gap-3">
        {toasts.map((toast) => {
          const Icon = toneIcon[toast.tone];
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto rounded-2xl border p-4 shadow-panel backdrop-blur ${toneStyles[toast.tone]}`}
            >
              <div className="flex items-start gap-3">
                <Icon className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-medium">{toast.title}</p>
                  {toast.description ? <p className="mt-1 text-sm text-white/80">{toast.description}</p> : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

