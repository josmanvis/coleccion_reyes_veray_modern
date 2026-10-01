"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import ConfirmDialog, { type ConfirmTone } from "./ConfirmDialog";
import { useToast } from "./ToastProvider";
import { useTr } from "@/components/I18nProvider";
import { buildFromElement, type MenuContext } from "./context-menus";

/**
 * Right-click menus, so the admin behaves like the desktop app it ships as.
 *
 * Two ways in. Server-rendered rows mark themselves with `data-ctx="artwork"`
 * and friends (see context-data.ts) and a single document listener builds the
 * menu from that markup — no client wrapper per row. Client components that
 * already hold the state and handlers pass items directly through
 * `useContextMenu()`.
 *
 * Inside CRVMGMT the items are shown as a native menu through the preload
 * bridge; in a browser they render here. Text fields and selected text keep
 * the platform's own menu (spelling, paste…), and Shift + right-click always
 * falls through to it.
 */

export type MenuItem = {
  label: string;
  icon?: LucideIcon;
  run: () => unknown;
  disabled?: boolean;
  danger?: boolean;
  /** Shows a check mark, for the current choice among options. */
  checked?: boolean;
};

/** Falsy entries are skipped, so items can be written `condition && {…}`. */
export type MenuEntry = MenuItem | "separator" | false | "" | 0 | null | undefined;

type ConfirmOptions = {
  title: string;
  body?: React.ReactNode;
  detail?: React.ReactNode;
  confirmLabel?: string;
  tone?: ConfirmTone;
};

type NativeItem = { id?: number; label?: string; enabled?: boolean; checked?: boolean; type?: "separator" };

type Bridge = {
  showContextMenu?: (items: NativeItem[]) => Promise<number | null>;
};

type Open = { x: number; y: number; items: Array<MenuItem | "separator">; keyboard: boolean };

type Api = {
  show: (event: React.MouseEvent | MouseEvent, entries: MenuEntry[]) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ContextMenuContext = createContext<Api | null>(null);

/** Drops falsy entries and the separators they leave doubled or dangling. */
export function tidy(entries: MenuEntry[]): Array<MenuItem | "separator"> {
  const out: Array<MenuItem | "separator"> = [];
  for (const entry of entries) {
    if (!entry) continue;
    if (entry === "separator" && (out.length === 0 || out[out.length - 1] === "separator")) continue;
    out.push(entry);
  }
  while (out[out.length - 1] === "separator") out.pop();
  return out;
}

/**
 * `onContextMenu={menu(() => [...])}`. Items are built lazily, on the click,
 * so they always reflect the row's current state.
 */
export function useContextMenu() {
  const api = useContext(ContextMenuContext);
  return useCallback(
    (build: () => MenuEntry[]) => (event: React.MouseEvent) => {
      if (!api || event.shiftKey) return;
      // A field inside the row keeps its own edit menu.
      if (isEditable(event.target as Element)) return;
      api.show(event, build());
    },
    [api]
  );
}

/** Imperative confirmation, for menu actions that write. */
export function useMenuConfirm() {
  return useContext(ContextMenuContext)?.confirm ?? (async () => window.confirm());
}

export function isEditable(target: Element | null): boolean {
  if (!target) return false;
  const field = target.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']");
  if (!field) return false;
  if (field instanceof HTMLInputElement) {
    return !["button", "checkbox", "radio", "submit", "reset", "file", "image", "range", "color"].includes(field.type);
  }
  return true;
}

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Older shells without the async clipboard: the selection trick still works.
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
}

/** Downloads through a link, so the server's filename is kept and the page stays put. */
export function download(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = "";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function selectedText(): string {
  return window.getSelection()?.toString().trim() ?? "";
}

export default function ContextMenuProvider({
  shareOrigin,
  children,
}: {
  /** This machine's network address, so shared links open on other devices. */
  shareOrigin: string | null;
  children: React.ReactNode;
}) {
  const tr = useTr();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const { notify } = useToast();
  const [open, setOpen] = useState<Open | null>(null);
  const [asking, setAsking] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setAsking({ ...options, resolve })),
    []
  );

  const run = useCallback(
    async (item: MenuItem) => {
      try {
        await item.run();
      } catch (error) {
        notify((error as Error).message || tr("No se pudo completar"), "error");
      }
    },
    [notify, tr]
  );

  const show = useCallback(
    (event: React.MouseEvent | MouseEvent, entries: MenuEntry[]) => {
      const items = tidy(entries);
      if (items.length === 0) return;
      event.preventDefault();
      event.stopPropagation();

      // The keyboard menu key reports no pointer position; anchor to the element.
      let { clientX: x, clientY: y } = event;
      const keyboard = x === 0 && y === 0;
      if (keyboard) {
        const rect = (event.target as Element).getBoundingClientRect();
        x = rect.left + 8;
        y = rect.bottom;
      }

      const bridge = (window as unknown as { crvmgmt?: Bridge }).crvmgmt;
      if (bridge?.showContextMenu) {
        const actions = new Map<number, MenuItem>();
        const native: NativeItem[] = items.map((item, index) => {
          if (item === "separator") return { type: "separator" };
          actions.set(index, item);
          return { id: index, label: item.label, enabled: !item.disabled, checked: item.checked };
        });
        void bridge.showContextMenu(native).then((id) => {
          const chosen = id === null ? undefined : actions.get(id);
          if (chosen) void run(chosen);
        });
        return;
      }

      setOpen({ x, y, items, keyboard });
    },
    [run]
  );

  const api = useMemo(() => ({ show, confirm }), [show, confirm]);

  // Shared by every builder, so markup-driven menus can navigate, write and confirm.
  const ctxRef = useRef<MenuContext | null>(null);
  useLayoutEffect(() => {
    ctxRef.current = { tr, router, pathname, notify, confirm, copy: copyText, shareOrigin };
  });

  useEffect(() => {
    function onContextMenu(event: MouseEvent) {
      // Handled by a component, or the user asked for the platform's menu.
      if (event.defaultPrevented || event.shiftKey) return;
      const target = event.target as Element | null;
      const ctx = ctxRef.current;
      if (!target || !ctx || isEditable(target)) return;

      const text = selectedText();
      const items = buildFromElement(target, ctx, { hasSelection: Boolean(text) });
      if (!items) return;

      show(event, [
        text && {
          label: ctx.tr("Copiar"),
          run: async () => {
            await copyText(text);
          },
        },
        text && "separator",
        ...items,
      ]);
    }
    document.addEventListener("contextmenu", onContextMenu);
    return () => document.removeEventListener("contextmenu", onContextMenu);
  }, [show]);

  // A route change closes whatever was open on the old page.
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOpen(null);
  }

  return (
    <ContextMenuContext.Provider value={api}>
      {children}
      {open && (
        <MenuSurface
          key={`${open.x}:${open.y}`}
          open={open}
          onClose={() => setOpen(null)}
          onRun={(item) => {
            setOpen(null);
            void run(item);
          }}
        />
      )}
      <ConfirmDialog
        open={asking !== null}
        title={asking?.title ?? ""}
        body={asking?.body}
        detail={asking?.detail}
        confirmLabel={asking?.confirmLabel ?? tr("Confirmar")}
        cancelLabel={tr("Cancelar")}
        tone={asking?.tone}
        onConfirm={() => {
          asking?.resolve(true);
          setAsking(null);
        }}
        onCancel={() => {
          asking?.resolve(false);
          setAsking(null);
        }}
      />
    </ContextMenuContext.Provider>
  );
}

function MenuSurface({
  open,
  onClose,
  onRun,
}: {
  open: Open;
  onClose: () => void;
  onRun: (item: MenuItem) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  // Measured before paint and kept inside the window, flipping up or left
  // the way a native menu does near an edge.
  useLayoutEffect(() => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const margin = 6;
    let left = open.x;
    let top = open.y;
    if (left + box.width > window.innerWidth - margin) left = Math.max(margin, open.x - box.width);
    if (top + box.height > window.innerHeight - margin) top = Math.max(margin, open.y - box.height);
    setPosition({ left, top });
  }, [open]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const menu = ref.current;
    if (open.keyboard) menu?.querySelector<HTMLElement>("[role=menuitem]:not([disabled])")?.focus();
    else menu?.focus();

    function onPointer(event: MouseEvent) {
      if (!menu?.contains(event.target as Node)) onClose();
    }
    function onMenuAgain(event: MouseEvent) {
      // Right-clicking inside the open menu should not open another one.
      if (menu?.contains(event.target as Node)) event.preventDefault();
    }
    window.addEventListener("mousedown", onPointer, true);
    window.addEventListener("contextmenu", onMenuAgain, true);
    window.addEventListener("resize", onClose);
    window.addEventListener("blur", onClose);
    window.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("mousedown", onPointer, true);
      window.removeEventListener("contextmenu", onMenuAgain, true);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("blur", onClose);
      window.removeEventListener("scroll", onClose, true);
      previous?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  function onKeyDown(event: React.KeyboardEvent) {
    const items = [...(ref.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([disabled])") ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const focus = (i: number) => items[(i + items.length) % items.length]?.focus();

    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      focus(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focus(index < 0 ? items.length - 1 : index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focus(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focus(items.length - 1);
    } else if (event.key.length === 1 && /\S/.test(event.key)) {
      // Type-ahead: jump to the next item starting with that letter.
      const letter = event.key.toLowerCase();
      const order = [...items.slice(index + 1), ...items.slice(0, index + 1)];
      order.find((el) => el.textContent?.trim().toLowerCase().startsWith(letter))?.focus();
    }
  }

  const hasChecks = open.items.some((item) => item !== "separator" && item.checked !== undefined);

  return (
    <div
      ref={ref}
      role="menu"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      style={{
        left: position?.left ?? open.x,
        top: position?.top ?? open.y,
        visibility: position ? "visible" : "hidden",
      }}
      className="fixed z-[70] min-w-[220px] max-w-[320px] select-none rounded-[6px] border border-[var(--stroke)] bg-[var(--surface)] p-1 text-sm shadow-[var(--shadow-16)] outline-none"
    >
      {open.items.map((item, index) =>
        item === "separator" ? (
          <div key={`sep-${index}`} role="separator" className="mx-1 my-1 h-px bg-[var(--stroke-soft)]" />
        ) : (
          <button
            key={`${item.label}-${index}`}
            type="button"
            role={item.checked === undefined ? "menuitem" : "menuitemcheckbox"}
            aria-checked={item.checked}
            disabled={item.disabled}
            onClick={() => onRun(item)}
            className={`flex w-full items-center gap-2.5 rounded-[4px] px-2 py-[5px] text-left outline-none transition-colors disabled:cursor-default disabled:text-[var(--ink-4)] ${
              item.danger
                ? "text-[var(--danger)] hover:bg-[var(--danger-soft)] focus:bg-[var(--danger-soft)]"
                : "text-[var(--ink-1)] hover:bg-[var(--hover)] focus:bg-[var(--hover)]"
            }`}
          >
            {hasChecks && (
              <span aria-hidden className="w-3 shrink-0 text-center text-xs">
                {item.checked ? "✓" : ""}
              </span>
            )}
            <span aria-hidden className="flex w-4 shrink-0 justify-center">
              {item.icon && <item.icon size={15} strokeWidth={1.75} />}
            </span>
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
          </button>
        )
      )}
    </div>
  );
}
