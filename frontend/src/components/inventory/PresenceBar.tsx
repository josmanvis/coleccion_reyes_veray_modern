"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { bubbleColor, initialsOf } from "@/lib/inventory/theme";

/**
 * Who else is in CRVMGMT, as a row of bubbles.
 *
 * The tab decides its own state, because only the browser knows whether anyone
 * is actually there: a hidden tab is away at once, a visible tab with no
 * keyboard or mouse for two minutes is idle, and anything else is active. The
 * server is never asked to guess from request timing.
 *
 * The identifier is per tab and lives in sessionStorage, so two windows on one
 * machine are two heartbeats — and closing one does not take the other out of
 * the bar.
 */

type Present = {
  userId: number;
  name: string;
  accent: string;
  avatar: string | null;
  role: string;
  state: "active" | "idle" | "away";
  page: string;
  origin: string;
  secondsAgo: number;
};

const IDLE_AFTER_MS = 2 * 60 * 1000;
const POLL_MS = 25_000;
const MAX_BUBBLES = 5;

function tabToken(): string {
  const KEY = "crvmgmt.presence";
  try {
    const held = sessionStorage.getItem(KEY);
    if (held) return held;
    const minted = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(KEY, minted);
    return minted;
  } catch {
    // Private windows can refuse storage; a per-load id still works, it just
    // counts as a new tab after a reload.
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export default function PresenceBar() {
  const [users, setUsers] = useState<Present[]>([]);
  const [me, setMe] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  // Kept in refs, not state: the heartbeat reads them, and re-rendering on
  // every mouse move would be absurd.
  // Zero until the effect stamps it: reading the clock during render is not
  // something a component may do.
  const lastInput = useRef(0);
  const token = useRef<string>("");

  const beat = useCallback(async (leaving = false) => {
    if (!token.current) return;
    const state = document.hidden
      ? "away"
      : Date.now() - lastInput.current > IDLE_AFTER_MS
        ? "idle"
        : "active";

    try {
      const response = await fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token.current,
          state,
          page: location.pathname,
          leaving,
        }),
        keepalive: leaving,
      });
      if (!response.ok) return;
      const data = (await response.json()) as { users: Present[]; me: number };
      if (!leaving) {
        setUsers(data.users);
        setMe(data.me);
      }
    } catch {
      // A missed beat is not worth surfacing; the next one carries the state.
    }
  }, []);

  useEffect(() => {
    token.current = tabToken();
    lastInput.current = Date.now();
    void beat();

    const timer = setInterval(() => void beat(), POLL_MS);
    const touch = () => {
      lastInput.current = Date.now();
    };
    const events = ["pointerdown", "keydown", "wheel", "focus"] as const;
    for (const event of events) window.addEventListener(event, touch, { passive: true });

    // Coming back to the tab should update the bar immediately rather than on
    // the next tick, which is what makes the bubbles feel live.
    const onVisibility = () => {
      if (!document.hidden) touch();
      void beat();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onLeave = () => void beat(true);
    window.addEventListener("pagehide", onLeave);

    return () => {
      clearInterval(timer);
      for (const event of events) window.removeEventListener(event, touch);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onLeave);
    };
  }, [beat]);

  if (users.length === 0) return null;

  const ordered = [...users].sort((a, b) => (a.userId === me ? -1 : b.userId === me ? 1 : 0));
  const shown = ordered.slice(0, MAX_BUBBLES);
  const extra = ordered.length - shown.length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="app-no-drag flex items-center -space-x-1.5 rounded-full p-0.5 transition-colors hover:bg-white/15"
        aria-label={`${users.length} persona(s) en CRVMGMT`}
        aria-expanded={open}
      >
        {shown.map((user) => (
          <Bubble key={user.userId} user={user} isMe={user.userId === me} />
        ))}
        {extra > 0 && (
          <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-[var(--brand)] bg-white/25 text-[11px] font-semibold text-white ring-1 ring-white/30">
            +{extra}
          </span>
        )}
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
          <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-[var(--radius)] border border-[var(--stroke-soft)] bg-[var(--surface)] shadow-[var(--shadow-16)]">
            <p className="border-b border-[var(--stroke-soft)] px-3 py-2 text-xs font-semibold text-[var(--ink-2)]">
              En CRVMGMT ahora
            </p>
            <ul className="max-h-80 overflow-auto py-1">
              {ordered.map((user) => (
                <li key={user.userId} className="flex items-center gap-2.5 px-3 py-1.5">
                  <Bubble user={user} isMe={user.userId === me} onCanvas />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--ink-1)]">
                      {user.name}
                      {user.userId === me && (
                        <span className="ml-1 text-[var(--ink-3)]">(tú)</span>
                      )}
                    </p>
                    <p className="truncate text-xs text-[var(--ink-3)]">
                      {stateLabel(user)} · {user.origin}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function stateLabel(user: Present): string {
  if (user.state === "active") return "Trabajando";
  if (user.state === "idle") return "Inactivo";
  const minutes = Math.round(user.secondsAgo / 60);
  return minutes < 1 ? "En otra ventana" : `Ausente ${minutes} min`;
}

function Bubble({
  user,
  isMe,
  onCanvas = false,
}: {
  user: Present;
  isMe: boolean;
  onCanvas?: boolean;
}) {
  const tint = user.accent?.trim() || bubbleColor(user.name);
  // Idle and away fade rather than change shape, so the row stays scannable.
  const opacity = user.state === "active" ? 1 : user.state === "idle" ? 0.65 : 0.4;

  return (
    <span
      className="relative inline-grid h-7 w-7 shrink-0 place-items-center rounded-full"
      title={`${user.name} — ${stateLabel(user)}`}
      style={{ opacity }}
    >
      {user.avatar ? (
        // A stored data URL, not a remote file: next/image would only add a
        // round trip through the optimizer for something already inline.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.avatar}
          alt={user.name}
          className={`h-7 w-7 rounded-full object-cover ${
            onCanvas ? "ring-1 ring-[var(--stroke)]" : "ring-2 ring-white/70"
          }`}
        />
      ) : (
        <span
          className={`grid h-7 w-7 place-items-center rounded-full text-[11px] font-semibold text-white ${
            onCanvas ? "ring-1 ring-[var(--stroke)]" : "ring-2 ring-white/70"
          }`}
          style={{ background: tint }}
        >
          {initialsOf(user.name)}
        </span>
      )}

      {/* The activity dot: green working, amber idle, hollow away. */}
      <span
        className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 ${
          onCanvas ? "border-[var(--surface)]" : "border-[var(--brand)]"
        } ${
          user.state === "active"
            ? "bg-[#13a10e]"
            : user.state === "idle"
              ? "bg-[#f7a900]"
              : "bg-[var(--ink-4)]"
        }`}
        aria-hidden
      />
      {isMe && <span className="sr-only">Tú</span>}
    </span>
  );
}
