"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

/** A single follow-up, like "Deshacer" after a delete. */
export type ToastAction = { label: string; run: () => void | Promise<void> };

type Toast = { id: number; message: string; tone: "success" | "error"; action?: ToastAction };

const ToastContext = createContext<{
  notify: (message: string, tone?: Toast["tone"], action?: ToastAction) => void;
}>({ notify: () => {} });

/** Confirms that a write actually landed, so an edit never fails silently. */
export function useToast() {
  return useContext(ToastContext);
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, tone: Toast["tone"] = "success", action?: ToastAction) => {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { id, message, tone, action }]);
      // A toast with a button stays long enough to reach it.
      setTimeout(() => dismiss(id), action ? 8000 : 4000);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-4 left-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 rounded-md border px-4 py-3 text-sm shadow-lg ${
              toast.tone === "error"
                ? "border-red-300 bg-red-50 text-red-900"
                : "border-emerald-300 bg-emerald-50 text-emerald-900"
            }`}
          >
            <span className="min-w-0 flex-1">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  dismiss(toast.id);
                  void toast.action?.run();
                }}
                className="shrink-0 rounded px-2 py-0.5 font-semibold underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-current"
              >
                {toast.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
