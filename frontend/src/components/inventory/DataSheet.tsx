"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ArrowDownToLine,
  ClipboardPaste,
  Columns3,
  Copy,
  Eraser,
  ExternalLink,
  Redo2,
  Save,
  Scissors,
  Undo2,
  X,
} from "lucide-react";
import { useTr } from "@/components/I18nProvider";
import { useToast } from "./ToastProvider";
import { useContextMenu } from "./ContextMenu";
import { BTN, BTN_PRIMARY, BTN_SUBTLE } from "./ui";

/**
 * A spreadsheet over any list of records, for working the way the collection
 * was kept for years in Excel and FileMaker: arrow keys, type to overwrite,
 * paste a block straight out of a spreadsheet, fill down, undo.
 *
 * Nothing is written while typing. Edits are staged and highlighted, and one
 * save sends them all, so a wrong paste over forty rows is a ⌘Z rather than
 * forty records to put back by hand. The caller decides how a save reaches the
 * server; this component only knows rows, columns and strings.
 *
 * No server imports: it is a client component (see project-client-server-module-split).
 */

export type SheetColumnType = "text" | "longtext" | "int" | "money" | "date" | "select";

export type SheetColumn = {
  key: string;
  /** Already translated. */
  label: string;
  type?: SheetColumnType;
  width?: number;
  readOnly?: boolean;
  /** For `select`: the only values a cell may take. */
  options?: Array<{ value: string; label: string }>;
  /** Offered as autocomplete while typing, like a FileMaker value list. */
  suggestions?: string[];
  /** Hidden until switched on in the column menu. */
  hidden?: boolean;
  /** Renders the header as a link, for sorting through the URL. */
  sort?: { href: string; active: boolean; dir: "asc" | "desc" };
};

export type SheetRow = {
  id: string;
  /** Shown in the frozen first column. */
  header: string;
  href?: string;
  values: Record<string, string>;
};

export type SheetSaveResult = {
  /** The stored values after the server coerced them, by row id. */
  saved: Record<string, Record<string, string>>;
  /** A message for each row that could not be written. */
  failed: Record<string, string>;
};

export type SheetChange = { id: string; patch: Record<string, string> };

type Edits = Record<string, Record<string, string>>;
type Change = { id: string; key: string; before: string | undefined; after: string | undefined };
type Selection = { ar: number; ac: number; fr: number; fc: number };
type Editing = { r: number; c: number; initial: string; replace: boolean };
type Direction = "down" | "up" | "right" | "left" | "none";

const ROW_H = 32;
const HEADER_W = 92;
const MIN_W = 56;
const DEFAULT_W: Record<SheetColumnType, number> = {
  text: 160,
  longtext: 240,
  int: 80,
  money: 110,
  date: 120,
  select: 130,
};

// --- Values ------------------------------------------------------------------

function isValid(column: SheetColumn, value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  switch (column.type) {
    case "int":
      return /^-?\d+$/.test(v);
    case "money":
      return /^\$?\s*-?[\d,]*\.?\d+$/.test(v);
    case "date":
      return /^\d{4}(-\d{2}(-\d{2})?)?$/.test(v);
    case "select":
      return !column.options || column.options.some((o) => o.value === v);
    default:
      return true;
  }
}

function display(column: SheetColumn, value: string): string {
  if (!value) return "";
  if (column.type === "money" && isValid(column, value)) {
    const n = Number(value.replace(/[$,\s]/g, ""));
    if (Number.isFinite(n)) return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  }
  if (column.type === "select") return column.options?.find((o) => o.value === value)?.label ?? value;
  return value.replace(/\s*\n\s*/g, " ⏎ ");
}

/** Pasting a select by its label works too: "Donación" lands as "donacion". */
function normalizeIn(column: SheetColumn, value: string): string {
  if (column.type !== "select" || !column.options) return value;
  const v = value.trim().toLowerCase();
  return column.options.find((o) => o.value.toLowerCase() === v || o.label.toLowerCase() === v)?.value ?? value;
}

// --- Clipboard: tab-separated, quoted the way Excel and Numbers write it ------

function toTsv(grid: string[][]): string {
  const quote = (v: string) => (/[\t\n"]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return grid.map((row) => row.map(quote).join("\t")).join("\n");
}

function parseTsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/\r\n?/g, "\n").replace(/\n$/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === "\t") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

// --- Layout, remembered per sheet --------------------------------------------

/**
 * Column widths and visibility live in localStorage, read through
 * useSyncExternalStore (as NavRail does) so the server render has a defined
 * value and React stays in step with the store.
 */
type Layout = { widths: Record<string, number>; shown: Record<string, boolean> };

const LAYOUT_EVENT = "crv:sheet-layout";

function subscribeLayout(onChange: () => void) {
  window.addEventListener(LAYOUT_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(LAYOUT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readLayout(key: string): string {
  try {
    return localStorage.getItem(`crv:sheet:${key}`) || "{}";
  } catch {
    return "{}";
  }
}

function parseLayout(raw: string): Layout {
  try {
    const parsed = JSON.parse(raw);
    return { widths: parsed.widths ?? {}, shown: parsed.shown ?? {} };
  } catch {
    return { widths: {}, shown: {} };
  }
}

function saveLayout(key: string, layout: Layout) {
  try {
    localStorage.setItem(`crv:sheet:${key}`, JSON.stringify(layout));
  } catch {
    // Private windows refuse storage; the layout simply is not remembered.
  }
  window.dispatchEvent(new Event(LAYOUT_EVENT));
}

// --- The sheet ---------------------------------------------------------------

export default function DataSheet({
  columns,
  rows,
  storageKey,
  onSave,
  footer,
}: {
  columns: SheetColumn[];
  rows: SheetRow[];
  /** Remembers column widths and visibility in this browser. */
  storageKey: string;
  onSave: (changes: SheetChange[]) => Promise<SheetSaveResult>;
  footer?: React.ReactNode;
}) {
  const tr = useTr();
  const { notify } = useToast();
  const menu = useContextMenu();

  const rawLayout = useSyncExternalStore(
    subscribeLayout,
    () => readLayout(storageKey),
    () => "{}"
  );
  const layout = useMemo(() => parseLayout(rawLayout), [rawLayout]);
  const updateLayout = useCallback(
    (next: (current: Layout) => Layout) => saveLayout(storageKey, next(parseLayout(readLayout(storageKey)))),
    [storageKey]
  );

  const visible = useMemo(
    () => columns.filter((c) => layout.shown[c.key] ?? !c.hidden),
    [columns, layout.shown]
  );
  const widths = useMemo(
    () => visible.map((c) => layout.widths[c.key] ?? c.width ?? DEFAULT_W[c.type ?? "text"]),
    [visible, layout.widths]
  );

  const [edits, setEdits] = useState<Edits>({});
  // Values the server confirmed, shown until the refreshed rows arrive.
  const [saved, setSaved] = useState<Edits>({});
  const [savedFor, setSavedFor] = useState(rows);
  if (savedFor !== rows) {
    setSavedFor(rows);
    setSaved({});
  }
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const history = useRef<{ undo: Change[][]; redo: Change[][] }>({ undo: [], redo: [] });
  const [historySize, setHistorySize] = useState({ undo: 0, redo: 0 });
  const syncHistory = () =>
    setHistorySize({ undo: history.current.undo.length, redo: history.current.redo.length });

  const [rawSel, setSel] = useState<Selection>({ ar: 0, ac: 0, fr: 0, fc: 0 });
  const [editing, setEditing] = useState<Editing | null>(null);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const grid = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const rowCount = rows.length;
  const colCount = visible.length;

  // Keep the cursor inside the grid when rows or columns change under it.
  const sel = useMemo(() => {
    const clampR = (r: number) => Math.max(0, Math.min(r, rowCount - 1));
    const clampC = (c: number) => Math.max(0, Math.min(c, colCount - 1));
    return { ar: clampR(rawSel.ar), ac: clampC(rawSel.ac), fr: clampR(rawSel.fr), fc: clampC(rawSel.fc) };
  }, [rawSel, rowCount, colCount]);

  const base = useCallback(
    (r: number, key: string) => {
      const row = rows[r];
      return saved[row.id]?.[key] ?? row.values[key] ?? "";
    },
    [rows, saved]
  );
  const valueAt = useCallback(
    (r: number, c: number) => {
      const key = visible[c].key;
      return edits[rows[r].id]?.[key] ?? base(r, key);
    },
    [edits, rows, visible, base]
  );

  const dirtyCount = useMemo(
    () => Object.values(edits).reduce((n, row) => n + Object.keys(row).length, 0),
    [edits]
  );
  const dirtyRows = Object.keys(edits).length;

  const invalid = useMemo(() => {
    const out: Array<{ id: string; key: string }> = [];
    const byKey = new Map(columns.map((c) => [c.key, c]));
    for (const [id, row] of Object.entries(edits)) {
      for (const [key, value] of Object.entries(row)) {
        const column = byKey.get(key);
        if (column && !isValid(column, value)) out.push({ id, key });
      }
    }
    return out;
  }, [edits, columns]);

  // --- Writing into the staged edits -----------------------------------------

  const applyChanges = useCallback((changes: Change[], direction: "undo" | "redo" | "do") => {
    if (changes.length === 0) return;
    setEdits((current) => {
      const next: Edits = { ...current };
      for (const change of changes) {
        const value = direction === "undo" ? change.before : change.after;
        const row = { ...(next[change.id] ?? {}) };
        if (value === undefined) delete row[change.key];
        else row[change.key] = value;
        if (Object.keys(row).length) next[change.id] = row;
        else delete next[change.id];
      }
      return next;
    });
    const h = history.current;
    if (direction === "do") {
      h.undo.push(changes);
      h.redo = [];
    } else if (direction === "undo") h.redo.push(changes);
    else h.undo.push(changes);
    syncHistory();
  }, []);

  /** Writes values into cells, skipping read-only columns; a value equal to the stored one un-stages the cell. */
  const write = useCallback(
    (cells: Array<{ r: number; c: number; value: string }>) => {
      const changes: Change[] = [];
      for (const { r, c, value } of cells) {
        const column = visible[c];
        const row = rows[r];
        if (!column || !row || column.readOnly) continue;
        const stored = base(r, column.key);
        const before = edits[row.id]?.[column.key];
        const incoming = normalizeIn(column, value);
        const after = incoming === stored ? undefined : incoming;
        if (before !== after) changes.push({ id: row.id, key: column.key, before, after });
      }
      applyChanges(changes, "do");
      return changes.length;
    },
    [visible, rows, base, edits, applyChanges]
  );

  const undo = useCallback(() => {
    const changes = history.current.undo.pop();
    if (changes) applyChanges(changes, "undo");
  }, [applyChanges]);
  const redo = useCallback(() => {
    const changes = history.current.redo.pop();
    if (changes) applyChanges(changes, "redo");
  }, [applyChanges]);

  const discard = useCallback(() => {
    setEdits({});
    setFailed({});
    history.current = { undo: [], redo: [] };
    syncHistory();
  }, []);

  const save = useCallback(async () => {
    if (saving || dirtyCount === 0) return;
    if (invalid.length) {
      const column = columns.find((c) => c.key === invalid[0].key);
      notify(
        tr("{n} celda(s) con un valor no válido · {column}", { n: invalid.length, column: column?.label ?? "" }),
        "error"
      );
      return;
    }
    setSaving(true);
    const changes = Object.entries(edits).map(([id, patch]) => ({ id, patch }));
    try {
      const result = await onSave(changes);
      setSaved((current) => ({ ...current, ...result.saved }));
      setFailed(result.failed);
      setEdits((current) => {
        const next: Edits = {};
        for (const [id, patch] of Object.entries(current)) if (result.failed[id]) next[id] = patch;
        return next;
      });
      history.current = { undo: [], redo: [] };
      syncHistory();
      const ok = Object.keys(result.saved).length;
      const bad = Object.keys(result.failed).length;
      if (ok) notify(tr(ok === 1 ? "{n} registro guardado" : "{n} registros guardados", { n: ok }));
      if (bad) notify(tr("{n} registro(s) no se pudieron guardar", { n: bad }), "error");
    } catch (error) {
      notify(tr((error as Error).message || "No se pudo guardar"), "error");
    }
    setSaving(false);
  }, [saving, dirtyCount, invalid, columns, edits, onSave, notify, tr]);

  // --- Leaving with unsaved edits --------------------------------------------

  useEffect(() => {
    if (dirtyCount === 0) return;
    const message = tr("Hay cambios sin guardar en la hoja. ¿Salir y descartarlos?");
    const onUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
    };
    // Client-side navigation never fires beforeunload, so links are caught too.
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || event.metaKey || event.ctrlKey) return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirtyCount, tr]);

  // --- Selection --------------------------------------------------------------

  const range = useMemo(
    () => ({
      r0: Math.min(sel.ar, sel.fr),
      r1: Math.max(sel.ar, sel.fr),
      c0: Math.min(sel.ac, sel.fc),
      c1: Math.max(sel.ac, sel.fc),
    }),
    [sel]
  );

  const focusGrid = () => grid.current?.focus({ preventScroll: true });

  const moveTo = useCallback(
    (r: number, c: number, extend = false) => {
      const nr = Math.max(0, Math.min(r, rowCount - 1));
      const nc = Math.max(0, Math.min(c, colCount - 1));
      setSel((s) => (extend ? { ...s, fr: nr, fc: nc } : { ar: nr, ac: nc, fr: nr, fc: nc }));
    },
    [rowCount, colCount]
  );

  useLayoutEffect(() => {
    const cell = scroller.current?.querySelector(`[data-cell="${sel.fr}:${sel.fc}"]`);
    cell?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [sel.fr, sel.fc]);

  const rangeValues = useCallback(() => {
    const out: string[][] = [];
    for (let r = range.r0; r <= range.r1; r++) {
      const line: string[] = [];
      for (let c = range.c0; c <= range.c1; c++) line.push(valueAt(r, c));
      out.push(line);
    }
    return out;
  }, [range, valueAt]);

  const clearRange = useCallback(() => {
    const cells = [];
    for (let r = range.r0; r <= range.r1; r++)
      for (let c = range.c0; c <= range.c1; c++) cells.push({ r, c, value: "" });
    write(cells);
  }, [range, write]);

  const fillDown = useCallback(() => {
    if (range.r0 === range.r1) return;
    const cells = [];
    for (let c = range.c0; c <= range.c1; c++) {
      const value = valueAt(range.r0, c);
      for (let r = range.r0 + 1; r <= range.r1; r++) cells.push({ r, c, value });
    }
    write(cells);
  }, [range, valueAt, write]);

  const paste = useCallback(
    (text: string) => {
      const clip = parseTsv(text);
      const cells: Array<{ r: number; c: number; value: string }> = [];
      const single = clip.length === 1 && clip[0].length === 1;
      if (single) {
        // One value over a selection fills all of it, as in Excel.
        for (let r = range.r0; r <= range.r1; r++)
          for (let c = range.c0; c <= range.c1; c++) cells.push({ r, c, value: clip[0][0] });
      } else {
        clip.forEach((line, dr) =>
          line.forEach((value, dc) => {
            const r = range.r0 + dr;
            const c = range.c0 + dc;
            if (r < rowCount && c < colCount) cells.push({ r, c, value });
          })
        );
        const r1 = Math.min(range.r0 + clip.length - 1, rowCount - 1);
        const c1 = Math.min(range.c0 + Math.max(...clip.map((l) => l.length)) - 1, colCount - 1);
        setSel({ ar: range.r0, ac: range.c0, fr: r1, fc: c1 });
        const dropped = clip.length - (r1 - range.r0 + 1);
        if (dropped > 0) notify(tr("{n} fila(s) del portapapeles no caben en esta página", { n: dropped }), "error");
      }
      write(cells);
    },
    [range, rowCount, colCount, write, notify, tr]
  );

  // --- Editing a cell ---------------------------------------------------------

  const startEdit = useCallback(
    (r: number, c: number, replaceWith?: string) => {
      const column = visible[c];
      if (!column || !rows[r]) return;
      if (column.readOnly) {
        notify(tr("«{column}» no se puede editar aquí", { column: column.label }), "error");
        return;
      }
      setSel({ ar: r, ac: c, fr: r, fc: c });
      setEditing({
        r,
        c,
        initial: replaceWith ?? valueAt(r, c),
        replace: replaceWith !== undefined,
      });
    },
    [visible, rows, valueAt, notify, tr]
  );

  const commit = useCallback(
    (value: string, direction: Direction) => {
      if (!editing) return;
      write([{ r: editing.r, c: editing.c, value }]);
      setEditing(null);
      const { r, c } = editing;
      if (direction === "down") moveTo(r + 1, c);
      else if (direction === "up") moveTo(r - 1, c);
      else if (direction === "right") moveTo(r, c + 1);
      else if (direction === "left") moveTo(r, c - 1);
      requestAnimationFrame(focusGrid);
    },
    [editing, write, moveTo]
  );

  const cancel = useCallback(() => {
    setEditing(null);
    requestAnimationFrame(focusGrid);
  }, []);

  // --- Keyboard ---------------------------------------------------------------

  function onKeyDown(event: React.KeyboardEvent) {
    if (editing) return;
    const mod = event.metaKey || event.ctrlKey;
    const { fr, fc } = sel;
    const key = event.key;

    const go = (r: number, c: number) => {
      event.preventDefault();
      moveTo(r, c, event.shiftKey);
    };

    if (mod && key.toLowerCase() === "s") {
      event.preventDefault();
      save();
      return;
    }
    if (mod && key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if (mod && key.toLowerCase() === "y") {
      event.preventDefault();
      redo();
      return;
    }
    if (mod && key.toLowerCase() === "a") {
      event.preventDefault();
      setSel({ ar: 0, ac: 0, fr: rowCount - 1, fc: colCount - 1 });
      return;
    }
    if (mod && key.toLowerCase() === "d") {
      event.preventDefault();
      fillDown();
      return;
    }

    switch (key) {
      case "ArrowDown":
        return go(mod ? rowCount - 1 : fr + 1, fc);
      case "ArrowUp":
        return go(mod ? 0 : fr - 1, fc);
      case "ArrowRight":
        return go(fr, mod ? colCount - 1 : fc + 1);
      case "ArrowLeft":
        return go(fr, mod ? 0 : fc - 1);
      case "Home":
        return go(mod ? 0 : fr, 0);
      case "End":
        return go(mod ? rowCount - 1 : fr, colCount - 1);
      case "PageDown":
        return go(fr + 15, fc);
      case "PageUp":
        return go(fr - 15, fc);
      case "Tab":
        event.preventDefault();
        if (event.shiftKey) moveTo(fc === 0 ? fr - 1 : fr, fc === 0 ? colCount - 1 : fc - 1);
        else moveTo(fc === colCount - 1 ? fr + 1 : fr, fc === colCount - 1 ? 0 : fc + 1);
        return;
      case "Enter":
        event.preventDefault();
        if (event.shiftKey) moveTo(fr - 1, fc);
        else startEdit(fr, fc);
        return;
      case "F2":
        event.preventDefault();
        startEdit(fr, fc);
        return;
      case "Delete":
      case "Backspace":
        event.preventDefault();
        clearRange();
        return;
      case "Escape":
        setSel((s) => ({ ar: s.fr, ac: s.fc, fr: s.fr, fc: s.fc }));
        return;
    }

    // Typing on a cell replaces its contents, like a spreadsheet.
    if (key.length === 1 && !mod && !event.altKey) {
      event.preventDefault();
      startEdit(fr, fc, visible[fc]?.type === "select" ? undefined : key);
    }
  }

  function onCopy(event: React.ClipboardEvent) {
    if (editing) return;
    event.preventDefault();
    event.clipboardData.setData("text/plain", toTsv(rangeValues()));
  }

  function onCut(event: React.ClipboardEvent) {
    if (editing) return;
    onCopy(event);
    clearRange();
  }

  function onPaste(event: React.ClipboardEvent) {
    if (editing) return;
    event.preventDefault();
    paste(event.clipboardData.getData("text/plain"));
  }

  // --- Mouse ------------------------------------------------------------------

  useEffect(() => {
    const stop = () => (dragging.current = false);
    window.addEventListener("mouseup", stop);
    return () => window.removeEventListener("mouseup", stop);
  }, []);

  const onCellDown = useCallback(
    (event: React.MouseEvent, r: number, c: number) => {
      if (event.button !== 0) return;
      event.preventDefault();
      focusGrid();
      if (editing) setEditing(null);
      dragging.current = true;
      moveTo(r, c, event.shiftKey);
    },
    [editing, moveTo]
  );

  const onCellEnter = useCallback(
    (r: number, c: number) => {
      if (dragging.current) moveTo(r, c, true);
    },
    [moveTo]
  );

  const onCellMenu = useCallback(
    (event: React.MouseEvent, r: number, c: number) => {
      if (event.shiftKey) return;
      const inside = r >= range.r0 && r <= range.r1 && c >= range.c0 && c <= range.c1;
      if (!inside) moveTo(r, c);
      const row = rows[r];
      menu(() => [
        { label: tr("Editar celda"), run: () => startEdit(r, c), disabled: visible[c]?.readOnly },
        "separator",
        {
          label: tr("Copiar"),
          icon: Copy,
          run: () => navigator.clipboard.writeText(toTsv(inside ? rangeValues() : [[valueAt(r, c)]])),
        },
        {
          label: tr("Cortar"),
          icon: Scissors,
          run: async () => {
            await navigator.clipboard.writeText(toTsv(inside ? rangeValues() : [[valueAt(r, c)]]));
            clearRange();
          },
        },
        {
          label: tr("Pegar"),
          icon: ClipboardPaste,
          run: async () => {
            try {
              paste(await navigator.clipboard.readText());
            } catch {
              notify(tr("Usa ⌘V para pegar"), "error");
            }
          },
        },
        "separator",
        inside && range.r1 > range.r0 && { label: tr("Rellenar hacia abajo"), icon: ArrowDownToLine, run: fillDown },
        { label: tr("Borrar contenido"), icon: Eraser, run: clearRange },
        row?.href && "separator",
        row?.href && { label: tr("Abrir ficha"), icon: ExternalLink, run: () => window.open(row.href, "_blank") },
      ])(event);
    },
    [range, rows, visible, menu, tr, startEdit, rangeValues, valueAt, clearRange, paste, fillDown, moveTo, notify]
  );

  function selectRow(event: React.MouseEvent, r: number) {
    event.preventDefault();
    focusGrid();
    setEditing(null);
    if (event.shiftKey) setSel((s) => ({ ...s, ac: 0, fr: r, fc: colCount - 1 }));
    else setSel({ ar: r, ac: 0, fr: r, fc: colCount - 1 });
  }

  function selectColumn(event: React.MouseEvent, c: number) {
    if ((event.target as Element).closest("a, [data-resize]")) return;
    event.preventDefault();
    focusGrid();
    setEditing(null);
    if (event.shiftKey) setSel((s) => ({ ...s, ar: 0, fr: rowCount - 1, fc: c }));
    else setSel({ ar: 0, ac: c, fr: rowCount - 1, fc: c });
  }

  function startResize(event: React.MouseEvent, c: number) {
    event.preventDefault();
    event.stopPropagation();
    const key = visible[c].key;
    const startX = event.clientX;
    const startW = widths[c];
    const onMove = (e: MouseEvent) => {
      const width = Math.max(MIN_W, Math.round(startW + e.clientX - startX));
      updateLayout((l) => ({ ...l, widths: { ...l.widths, [key]: width } }));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // --- Render -----------------------------------------------------------------

  const focusColumn = visible[sel.fc];
  const focusRow = rows[sel.fr];
  const focusValue = focusRow && focusColumn ? valueAt(sel.fr, sel.fc) : "";
  const totalWidth = HEADER_W + widths.reduce((a, b) => a + b, 0);
  const selectedCount = (range.r1 - range.r0 + 1) * (range.c1 - range.c0 + 1);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--stroke-soft)] px-3 py-2">
        <button
          type="button"
          onClick={undo}
          disabled={historySize.undo === 0}
          className={BTN_SUBTLE}
          title={tr("Deshacer (⌘Z)")}
          aria-label={tr("Deshacer")}
        >
          <Undo2 size={15} strokeWidth={1.75} aria-hidden />
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={historySize.redo === 0}
          className={BTN_SUBTLE}
          title={tr("Rehacer (⇧⌘Z)")}
          aria-label={tr("Rehacer")}
        >
          <Redo2 size={15} strokeWidth={1.75} aria-hidden />
        </button>

        <div className="relative">
          <button type="button" onClick={() => setColumnsOpen((o) => !o)} className={BTN_SUBTLE} aria-expanded={columnsOpen}>
            <Columns3 size={15} strokeWidth={1.75} aria-hidden />
            {tr("Columnas")}
            <span className="font-normal text-[var(--ink-3)]">
              {visible.length}/{columns.length}
            </span>
          </button>
          {columnsOpen && (
            <ColumnMenu
              columns={columns}
              isShown={(c) => layout.shown[c.key] ?? !c.hidden}
              onToggle={(key, shown) => updateLayout((l) => ({ ...l, shown: { ...l.shown, [key]: shown } }))}
              onAll={() =>
                updateLayout((l) => ({ ...l, shown: Object.fromEntries(columns.map((c) => [c.key, true])) }))
              }
              onReset={() => updateLayout(() => ({ widths: {}, shown: {} }))}
              onClose={() => setColumnsOpen(false)}
            />
          )}
        </div>

        <p className="ml-1 hidden text-xs text-[var(--ink-3)] lg:block">
          {tr("Escribe para reemplazar · Intro o doble clic para editar · ⌘C / ⌘V con Excel · ⌘D rellena hacia abajo")}
        </p>

        <div className="ml-auto flex items-center gap-2">
          {dirtyCount > 0 && (
            <span className="text-xs font-semibold text-[var(--warning)]">
              {tr("{cells} cambio(s) en {rows} registro(s)", { cells: dirtyCount, rows: dirtyRows })}
            </span>
          )}
          <button type="button" onClick={discard} disabled={dirtyCount === 0 || saving} className={BTN}>
            <X size={15} strokeWidth={1.75} aria-hidden />
            {tr("Descartar")}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={dirtyCount === 0 || saving}
            className={BTN_PRIMARY}
            title={tr("Guardar (⌘S)")}
          >
            <Save size={15} strokeWidth={1.75} aria-hidden />
            {saving ? tr("Guardando…") : tr("Guardar")}
          </button>
        </div>
      </div>

      {/* Formula bar: the whole value of the current cell, however long. */}
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--stroke-soft)] bg-[var(--surface-alt)] px-3 py-1.5 text-xs">
        <span className="w-[220px] shrink-0 truncate font-semibold text-[var(--ink-2)]">
          {focusRow ? `${focusRow.header} · ${focusColumn?.label ?? ""}` : "—"}
          {selectedCount > 1 && (
            <span className="ml-2 font-normal text-[var(--ink-3)]">{tr("{n} celdas", { n: selectedCount })}</span>
          )}
        </span>
        <span
          className={`min-w-0 flex-1 truncate ${focusValue ? "text-[var(--ink-1)]" : "text-[var(--ink-4)]"}`}
          title={focusValue}
          onDoubleClick={() => startEdit(sel.fr, sel.fc)}
        >
          {focusValue || (focusColumn?.readOnly ? tr("Solo lectura") : tr("(vacío)"))}
        </span>
      </div>

      <div ref={scroller} className="relative min-h-0 flex-1 overflow-auto">
        <div
          ref={grid}
          tabIndex={0}
          role="grid"
          aria-rowcount={rowCount}
          aria-colcount={colCount}
          onKeyDown={onKeyDown}
          onCopy={onCopy}
          onCut={onCut}
          onPaste={onPaste}
          className="outline-none"
          style={{ width: totalWidth }}
        >
          <table className="border-separate border-spacing-0 text-[13px]" style={{ tableLayout: "fixed", width: totalWidth }}>
            <colgroup>
              <col style={{ width: HEADER_W }} />
              {widths.map((w, i) => (
                <col key={visible[i].key} style={{ width: w }} />
              ))}
            </colgroup>
            <thead>
              <tr style={{ height: ROW_H }}>
                <th className="sticky left-0 top-0 z-30 border-b border-r border-[var(--stroke)] bg-[var(--surface-alt)]" />
                {visible.map((column, c) => {
                  const active = c >= range.c0 && c <= range.c1;
                  return (
                    <th
                      key={column.key}
                      onMouseDown={(e) => selectColumn(e, c)}
                      className={`group/th sticky top-0 z-20 cursor-default select-none border-b border-r border-[var(--stroke)] px-2 text-left text-xs font-semibold ${
                        active ? "bg-[var(--brand-soft)] text-[var(--brand-hover)]" : "bg-[var(--surface-alt)] text-[var(--ink-2)]"
                      }`}
                    >
                      <div className="flex items-center gap-1 overflow-hidden">
                        {column.sort ? (
                          <Link href={column.sort.href} className="truncate hover:underline" title={column.label}>
                            {column.label}
                          </Link>
                        ) : (
                          <span className="truncate" title={column.label}>
                            {column.label}
                          </span>
                        )}
                        {column.sort?.active && (
                          <span className="text-[var(--brand)]">{column.sort.dir === "desc" ? "↓" : "↑"}</span>
                        )}
                        {column.readOnly && <span className="ml-auto text-[10px] font-normal text-[var(--ink-4)]">🔒</span>}
                      </div>
                      <span
                        data-resize
                        onMouseDown={(e) => startResize(e, c)}
                        onDoubleClick={() =>
                          updateLayout((l) => {
                            const w = { ...l.widths };
                            delete w[column.key];
                            return { ...l, widths: w };
                          })
                        }
                        className="absolute inset-y-0 -right-[3px] z-10 w-[6px] cursor-col-resize hover:bg-[var(--brand)]/40"
                        title={tr("Arrastra para cambiar el ancho · doble clic para restablecer")}
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => {
                const inRows = r >= range.r0 && r <= range.r1;
                return (
                  <SheetRowView
                    key={row.id}
                    listPrefix={`sheet-${storageKey}-`}
                    row={row}
                    r={r}
                    columns={visible}
                    edits={edits[row.id]}
                    saved={saved[row.id]}
                    error={failed[row.id]}
                    selC0={inRows ? range.c0 : -1}
                    selC1={inRows ? range.c1 : -1}
                    focusC={sel.fr === r ? sel.fc : -1}
                    editing={editing && editing.r === r ? editing : null}
                    onCellDown={onCellDown}
                    onCellEnter={onCellEnter}
                    onCellMenu={onCellMenu}
                    onRowHeader={selectRow}
                    onStartEdit={startEdit}
                    onCommit={commit}
                    onCancel={cancel}
                  />
                );
              })}
            </tbody>
          </table>

          {rows.length === 0 && (
            <p className="px-5 py-16 text-center text-sm text-[var(--ink-3)]">{tr("No hay registros que mostrar.")}</p>
          )}
        </div>

        {visible.map((column) =>
          column.suggestions?.length ? (
            <datalist key={column.key} id={`sheet-${storageKey}-${column.key}`}>
              {column.suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          ) : null
        )}
      </div>

      {footer}
    </div>
  );
}

// --- One row ------------------------------------------------------------------

const SheetRowView = memo(function SheetRowView({
  listPrefix,
  row,
  r,
  columns,
  edits,
  saved,
  error,
  selC0,
  selC1,
  focusC,
  editing,
  onCellDown,
  onCellEnter,
  onCellMenu,
  onRowHeader,
  onStartEdit,
  onCommit,
  onCancel,
}: {
  listPrefix: string;
  row: SheetRow;
  r: number;
  columns: SheetColumn[];
  edits: Record<string, string> | undefined;
  saved: Record<string, string> | undefined;
  error: string | undefined;
  selC0: number;
  selC1: number;
  focusC: number;
  editing: Editing | null;
  onCellDown: (e: React.MouseEvent, r: number, c: number) => void;
  onCellEnter: (r: number, c: number) => void;
  onCellMenu: (e: React.MouseEvent, r: number, c: number) => void;
  onRowHeader: (e: React.MouseEvent, r: number) => void;
  onStartEdit: (r: number, c: number) => void;
  onCommit: (value: string, direction: Direction) => void;
  onCancel: () => void;
}) {
  const tr = useTr();
  const rowSelected = selC0 >= 0;
  const dirty = edits && Object.keys(edits).length > 0;

  return (
    <tr style={{ height: ROW_H }}>
      <th
        scope="row"
        onMouseDown={(e) => {
          if ((e.target as Element).closest("a")) return;
          onRowHeader(e, r);
        }}
        title={error}
        className={`sticky left-0 z-10 cursor-default select-none border-b border-r border-[var(--stroke)] px-2 text-left font-mono text-[11px] font-normal ${
          rowSelected ? "bg-[var(--brand-soft)] text-[var(--brand-hover)]" : "bg-[var(--surface-alt)] text-[var(--ink-3)]"
        }`}
      >
        <div className="flex items-center gap-1.5">
          {error ? (
            <span className="size-1.5 shrink-0 rounded-full bg-[var(--danger)]" aria-label={error} />
          ) : dirty ? (
            <span className="size-1.5 shrink-0 rounded-full bg-[var(--warning)]" aria-label={tr("Modificado")} />
          ) : null}
          {row.href ? (
            <Link href={row.href} className="truncate hover:text-[var(--brand)] hover:underline" title={tr("Abrir ficha")}>
              {row.header}
            </Link>
          ) : (
            <span className="truncate">{row.header}</span>
          )}
        </div>
      </th>
      {columns.map((column, c) => {
        const staged = edits?.[column.key];
        const value = staged ?? saved?.[column.key] ?? row.values[column.key] ?? "";
        const isDirty = staged !== undefined;
        const bad = isDirty && !isValid(column, value);
        const selected = c >= selC0 && c <= selC1;
        const focused = c === focusC;
        const isEditing = editing?.c === c;
        const numeric = column.type === "int" || column.type === "money";

        return (
          <td
            key={column.key}
            data-cell={`${r}:${c}`}
            role="gridcell"
            aria-selected={selected}
            onMouseDown={(e) => onCellDown(e, r, c)}
            onMouseEnter={() => onCellEnter(r, c)}
            onDoubleClick={() => onStartEdit(r, c)}
            onContextMenu={(e) => onCellMenu(e, r, c)}
            title={bad ? tr("Valor no válido para «{column}»", { column: column.label }) : undefined}
            className={`relative cursor-cell scroll-ml-[92px] scroll-mt-8 overflow-hidden whitespace-nowrap border-b border-r border-[var(--stroke-soft)] px-2 ${
              numeric ? "text-right tabular-nums" : ""
            } ${column.readOnly ? "text-[var(--ink-3)]" : "text-[var(--ink-1)]"} ${
              bad
                ? "bg-[var(--danger-soft)]"
                : selected
                  ? "bg-[var(--brand-soft)]"
                  : isDirty
                    ? "bg-[var(--warning-soft)]"
                    : "bg-[var(--surface)]"
            }`}
            style={
              focused
                ? { boxShadow: "inset 0 0 0 2px var(--brand)" }
                : isDirty && selected
                  ? { boxShadow: "inset 3px 0 0 var(--warning)" }
                  : undefined
            }
          >
            <span className={`block truncate ${bad ? "text-[var(--danger)]" : ""}`}>{display(column, value)}</span>
            {isEditing && editing && (
              <CellEditor
                column={column}
                initial={editing.initial}
                listId={column.suggestions?.length ? `${listPrefix}${column.key}` : undefined}
                onCommit={onCommit}
                onCancel={onCancel}
              />
            )}
          </td>
        );
      })}
    </tr>
  );
});

// --- The in-cell editor --------------------------------------------------------

function CellEditor({
  column,
  initial,
  listId,
  onCommit,
  onCancel,
}: {
  column: SheetColumn;
  initial: string;
  listId?: string;
  onCommit: (value: string, direction: Direction) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement & HTMLSelectElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    // Caret at the end either way: after the typed letter, or after the old text.
    if (column.type !== "select") {
      const end = el.value.length;
      el.setSelectionRange(end, end);
    }
  }, [column.type]);

  const finish = (direction: Direction | null) => {
    if (done.current) return;
    done.current = true;
    if (direction === null) onCancel();
    else onCommit(value, direction);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    event.stopPropagation();
    const long = column.type === "longtext";
    if (event.key === "Escape") {
      event.preventDefault();
      finish(null);
    } else if (event.key === "Enter" && !(long && (event.altKey || event.shiftKey))) {
      event.preventDefault();
      finish(event.shiftKey ? "up" : "down");
    } else if (event.key === "Tab") {
      event.preventDefault();
      finish(event.shiftKey ? "left" : "right");
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      // Commit first; the grid's own ⌘S then picks the cell up.
      event.preventDefault();
      finish("none");
    }
  };

  const common = {
    onKeyDown,
    onBlur: () => finish("none"),
    onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
    onDoubleClick: (e: React.MouseEvent) => e.stopPropagation(),
    onCopy: (e: React.ClipboardEvent) => e.stopPropagation(),
    onPaste: (e: React.ClipboardEvent) => e.stopPropagation(),
    onCut: (e: React.ClipboardEvent) => e.stopPropagation(),
  };

  const box =
    "absolute left-0 top-0 z-40 m-0 w-full border-0 bg-[var(--surface)] px-2 text-[13px] text-[var(--ink-1)] outline-none shadow-[0_0_0_2px_var(--brand),var(--shadow-8,0_4px_12px_rgba(0,0,0,.15))]";

  if (column.type === "select") {
    return (
      <select
        ref={ref}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
        }}
        className={`${box} h-full`}
        {...common}
      >
        {!column.options?.some((o) => o.value === value) && <option value={value}>{value || "—"}</option>}
        {column.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  if (column.type === "longtext") {
    return (
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={5}
        className={`${box} min-h-[120px] min-w-[320px] resize py-1.5 leading-snug`}
        {...common}
      />
    );
  }

  return (
    <input
      ref={ref}
      value={value}
      list={listId}
      inputMode={column.type === "int" ? "numeric" : column.type === "money" ? "decimal" : undefined}
      onChange={(e) => setValue(e.target.value)}
      className={`${box} h-full ${column.type === "int" || column.type === "money" ? "text-right" : ""}`}
      {...common}
    />
  );
}

function ColumnMenu({
  columns,
  isShown,
  onToggle,
  onAll,
  onReset,
  onClose,
}: {
  columns: SheetColumn[];
  isShown: (column: SheetColumn) => boolean;
  onToggle: (key: string, shown: boolean) => void;
  onAll: () => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const tr = useTr();
  const ref = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const needle = filter.trim().toLowerCase();
  const list = columns.filter((c) => !needle || c.label.toLowerCase().includes(needle));

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full z-50 mt-1 w-[280px] rounded-[var(--radius)] border border-[var(--stroke)] bg-[var(--surface)] p-2 shadow-[var(--shadow-16,0_8px_24px_rgba(0,0,0,.18))]"
    >
      <input
        autoFocus
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={tr("Buscar columna…")}
        className="mb-2 w-full rounded-[var(--radius)] border border-[var(--stroke)] bg-[var(--surface)] px-2 py-1 text-sm outline-none focus:border-[var(--brand)]"
      />
      <div className="max-h-[50vh] overflow-y-auto">
        {list.map((column) => (
          <label
            key={column.key}
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-[var(--hover)]"
          >
            <input
              type="checkbox"
              checked={isShown(column)}
              onChange={(e) => onToggle(column.key, e.target.checked)}
              className="accent-[var(--brand)]"
            />
            <span className="truncate">{column.label}</span>
          </label>
        ))}
      </div>
      <div className="mt-2 flex justify-between border-t border-[var(--stroke-soft)] pt-2">
        <button type="button" onClick={onAll} className="text-xs font-semibold text-[var(--brand)] hover:underline">
          {tr("Mostrar todas")}
        </button>
        <button type="button" onClick={onReset} className="text-xs text-[var(--ink-3)] hover:underline">
          {tr("Restablecer columnas")}
        </button>
      </div>
    </div>
  );
}
