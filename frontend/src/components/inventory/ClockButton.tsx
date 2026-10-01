"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, Timer } from "lucide-react";
import { useToast } from "./ToastProvider";
import { useDateLocale, useTr } from "@/components/I18nProvider";

/**
 * Clocking in and out from the app bar.
 *
 * The running total is recomputed from the shift's start each second rather
 * than counted up locally, so a tab left open overnight, or one that was asleep,
 * still shows the true elapsed time when it comes back.
 */

type Shift = { id: number; startedAt: string; minutes: number } | null;

/**
 * The wall clock as an external store. The snapshot is the half-minute the
 * clock is in, so it is stable between ticks — reading `Date.now()` straight
 * would hand React a different value on every render.
 */
const TICK_MS = 30_000;

function subscribeToClock(onTick: () => void) {
  const timer = setInterval(onTick, TICK_MS);
  return () => clearInterval(timer);
}

function clockBucket(): number {
  return Math.floor(Date.now() / TICK_MS);
}

/** Nothing ticks during server rendering; the label fills in on hydration. */
function serverBucket(): number {
  return 0;
}

function elapsed(startedAt: string, now: number): string {
  const started = Date.parse(startedAt);
  if (!Number.isFinite(started)) return "";
  const minutes = Math.max(0, Math.floor((now - started) / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours === 0 ? `${minutes} min` : `${hours} h ${minutes % 60} min`;
}

export default function ClockButton() {
  const tr = useTr();
  const loc = useDateLocale();
  const router = useRouter();
  const { notify } = useToast();
  const [shift, setShift] = useState<Shift>(null);
  const bucket = useSyncExternalStore(subscribeToClock, clockBucket, serverBucket);
  const now = bucket * TICK_MS;
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/timeclock?limit=1");
      if (!response.ok) return;
      const data = (await response.json()) as { open: Shift };
      setShift(data.open);
    } catch {
      // Offline or signed out; the button simply stays as it was.
    }
  }, []);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    void load();
  }, [load]);

  async function send(action: "in" | "out") {
    setPending(true);
    try {
      const response = await fetch("/api/timeclock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: action === "out" ? note : undefined }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify(tr(data.error || "No se pudo registrar"), "error");
      } else if (action === "in") {
        setShift(data.shift);
        notify(tr("Entrada registrada"));
      } else {
        setShift(null);
        setNote("");
        setOpen(false);
        notify(tr("Salida registrada · {n} min", { n: Math.round(data.shift.minutes) }));
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (!shift) {
    return (
      <button
        type="button"
        onClick={() => void send("in")}
        disabled={pending}
        className="app-no-drag inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[var(--radius)] px-3 py-1.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/15 hover:text-white disabled:opacity-60"
        title={tr("Marcar entrada")}
      >
        <LogIn size={15} strokeWidth={1.75} aria-hidden />
        
        {tr("Entrar")}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="app-no-drag inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[var(--radius)] bg-white/15 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/25"
        title={tr("Jornada en curso")}
      >
        <span className="relative flex h-2 w-2" aria-hidden>
          <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-[#6bd66b] opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#13a10e]" />
        </span>
        {now > 0 ? elapsed(shift.startedAt, now) : tr("En curso")}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-[var(--radius)] border border-[var(--stroke-soft)] bg-[var(--surface)] p-3 shadow-[var(--shadow-16)]">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--ink-1)]">
              <Timer size={15} strokeWidth={1.75} aria-hidden />
              
              {tr("Jornada en curso")}
            </p>
            <p className="mt-0.5 text-xs text-[var(--ink-3)]">
              {tr("Desde {time}", {
                time: new Date(shift.startedAt).toLocaleTimeString(loc, {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              })}
            </p>

            <label className="mt-2.5 block">
              <span className="mb-1 block text-xs font-semibold text-[var(--ink-2)]">
                
                {tr("Nota (opcional)")}
              </span>
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={tr("En qué trabajaste")}
                className="w-full rounded-[var(--radius)] border border-[var(--stroke)] bg-[var(--surface)] px-2.5 py-[6px] text-sm text-[var(--ink-1)] outline-none focus:border-[var(--brand)]"
              />
            </label>

            <button
              type="button"
              onClick={() => void send("out")}
              disabled={pending}
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-[var(--radius)] bg-[var(--brand)] px-3.5 py-[7px] text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-60"
            >
              <LogOut size={15} strokeWidth={1.75} aria-hidden />
              {pending ? tr("Registrando…") : tr("Marcar salida")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
