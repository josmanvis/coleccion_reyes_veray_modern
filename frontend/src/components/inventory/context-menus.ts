import type { useRouter } from "next/navigation";
import {
  AppWindow,
  Archive,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Copy,
  Download,
  ExternalLink,
  FilePlus,
  Hash,
  Image as ImageIcon,
  LayoutGrid,
  Link as LinkIcon,
  ListFilter,
  MapPin,
  Palette,
  Pencil,
  Share,
  RotateCw,
  SortAsc,
  SortDesc,
  Table2,
  Tag,
  Trash2,
  Undo2,
  Zap,
} from "lucide-react";
import { deaccessionStatus, FOR_SALE_CODE, IN_INVENTORY_STATUS, withForSale } from "@/lib/inventory/fields";
import { download, type MenuEntry } from "./ContextMenu";
import { canShare, shareLabel, shareLink } from "./share";
import type { ConfirmTone } from "./ConfirmDialog";

/**
 * Menus built from markup: each `data-ctx` kind maps to a builder that reads
 * the element's `data-*` attributes (written by context-data.ts) and returns
 * its items. Whatever is not marked gets a link, image or page menu.
 */

type Tr = (es: string, vars?: Record<string, string | number>) => string;

export type MenuContext = {
  tr: Tr;
  router: ReturnType<typeof useRouter>;
  pathname: string;
  notify: (message: string, tone?: "success" | "error") => void;
  confirm: (options: {
    title: string;
    body?: React.ReactNode;
    detail?: React.ReactNode;
    confirmLabel?: string;
    tone?: ConfirmTone;
  }) => Promise<boolean>;
  copy: (text: string) => Promise<void>;
  shareOrigin: string | null;
};

type Builder = (el: HTMLElement, ctx: MenuContext) => MenuEntry[];

/** Running inside CRVMGMT, where a new window is a real window. */
export function isDesktop(): boolean {
  return Boolean((window as unknown as { crvmgmt?: unknown }).crvmgmt);
}

export function openWindow(path: string) {
  window.open(new URL(path, window.location.origin).href, "_blank", "noopener");
}

export function newWindowItem(path: string, tr: Tr): MenuEntry {
  return {
    label: isDesktop() ? tr("Abrir en una ventana nueva") : tr("Abrir en una pestaña nueva"),
    icon: AppWindow,
    run: () => openWindow(path),
  };
}

export function copyItem(label: string, text: string, ctx: MenuContext, icon = Copy): MenuEntry {
  return {
    label,
    icon,
    run: async () => {
      await ctx.copy(text);
    },
  };
}

/**
 * "AirDrop…" for an app path. The link is rebuilt on the network address so
 * it opens on the phone or Mac it lands on.
 */
export function shareItem(path: string, title: string | undefined, ctx: MenuContext): MenuEntry {
  if (!canShare()) return null;
  return {
    label: shareLabel(ctx.tr),
    icon: Share,
    run: async () => {
      const url = new URL(path, ctx.shareOrigin ?? window.location.origin).href;
      if (!(await shareLink(url, title))) ctx.notify(ctx.tr("Este navegador no puede compartir"), "error");
    },
  };
}

function absolute(path: string): string {
  return new URL(path, window.location.origin).href;
}

async function postAction(ref: string, payload: Record<string, unknown>, fallback: string, tr: Tr) {
  const response = await fetch(`/api/inventory/${encodeURIComponent(ref)}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(tr(body.error || fallback));
  return body;
}

const artwork: Builder = (el, ctx) => {
  const { tr, router, pathname, notify, confirm } = ctx;
  const d = el.dataset;
  const ref = d.ref ?? "";
  const registro = d.registro ?? ref;
  const href = `/inventory/${encodeURIComponent(ref)}`;
  const editHref = `/admin/artwork/${encodeURIComponent(ref)}`;
  const onRecord = decodeURIComponent(pathname) === `/inventory/${ref}`;
  const onEdit = decodeURIComponent(pathname) === `/admin/artwork/${ref}`;
  const hasQuickEdit = Boolean(document.querySelector(`[data-quick-edit="${CSS.escape(ref)}"]`));
  const forSale = d.forSale === "1";
  const deaccessed = d.deaccessed === "1";

  async function toggleSale() {
    const next = !forSale;
    const current = d.sales ? d.sales : null;
    const preview = withForSale(current, next);
    const show = (v: string | null) => (v === null ? tr("(vacío)") : `"${v}"`);
    const ok = await confirm({
      title: next ? tr("¿Marcar en venta?") : tr("¿Quitar de venta?"),
      body: next
        ? tr("La obra CRV #{n} aparecerá como disponible en el sitio público.", { n: registro })
        : tr("La obra CRV #{n} dejará de ofrecerse en el sitio público.", { n: registro }),
      detail: `${tr("Ventas:")} ${show(current)} → ${show(preview)}`,
      confirmLabel: next ? tr("Marcar en venta") : tr("Quitar de venta"),
    });
    if (!ok) return;
    await postAction(ref, { action: "for_sale", value: next }, "No se pudo cambiar", tr);
    notify(
      next
        ? tr("CRV #{registro} marcada en venta ({FOR_SALE_CODE})", { registro, FOR_SALE_CODE })
        : tr("CRV #{registro} ya no está en venta", { registro })
    );
    router.refresh();
  }

  async function changeStatus(action: "deaccession" | "reinstate") {
    const out = action === "deaccession";
    const ok = await confirm({
      title: out ? tr("¿De-accessar esta obra?") : tr("¿Devolver al inventario?"),
      body: out
        ? tr("CRV #{n} saldrá del inventario activo y dejará de aparecer en la galería pública.", { n: registro })
        : tr("CRV #{n} volverá a contarse como parte de la colección activa.", { n: registro }),
      detail: tr("Estatus: \"{status}\"", { status: out ? deaccessionStatus("") : IN_INVENTORY_STATUS }),
      confirmLabel: out ? tr("De-accessar") : tr("Devolver"),
    });
    if (!ok) return;
    await postAction(ref, { action }, "No se pudo cambiar el estatus", tr);
    notify(
      out
        ? tr("CRV #{registro} de-accessada", { registro })
        : tr("CRV #{registro} devuelta al inventario", { registro })
    );
    router.refresh();
  }

  async function remove() {
    const ok = await confirm({
      title: tr("¿Eliminar CRV #{registro} para siempre?", { registro }),
      body: tr("La ficha se borra de la base de datos y no se puede recuperar salvo volviendo a importar la hoja de cálculo."),
      tone: "danger",
      confirmLabel: tr("Sí, eliminar"),
    });
    if (!ok) return;
    const response = await fetch(`/api/inventory/${encodeURIComponent(ref)}`, { method: "DELETE" });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(tr(body.error || "No se pudo eliminar"));
    }
    notify(tr("CRV #{n} eliminada", { n: registro }));
    if (onRecord || onEdit) router.push("/inventory");
    router.refresh();
  }

  return [
    !onRecord && { label: tr("Abrir ficha"), icon: ArrowUpRight, run: () => router.push(href) },
    !onRecord && newWindowItem(href, tr),
    "separator",
    hasQuickEdit && {
      label: tr("Edición rápida…"),
      icon: Zap,
      run: () => window.dispatchEvent(new CustomEvent("crv:quick-edit", { detail: ref })),
    },
    !onEdit && { label: tr("Editar todos los campos"), icon: Pencil, run: () => router.push(editHref) },
    "separator",
    d.forSale !== undefined && {
      label: forSale ? tr("Quitar de venta…") : tr("Marcar en venta…"),
      icon: Tag,
      run: toggleSale,
    },
    d.artistLast && {
      label: tr("Ver obras de {artist}", { artist: d.artist || d.artistLast }),
      icon: Palette,
      run: () => router.push(`/inventory?artist=${encodeURIComponent(d.artistLast ?? "")}`),
    },
    d.location && {
      label: tr("Ver obras en {location}", { location: d.location }),
      icon: MapPin,
      run: () => router.push(`/inventory?location=${encodeURIComponent(d.location ?? "")}`),
    },
    "separator",
    copyItem(tr("Copiar número CRV"), registro, ctx, Hash),
    d.title && copyItem(tr("Copiar título"), d.title, ctx),
    copyItem(tr("Copiar enlace"), absolute(href), ctx, LinkIcon),
    shareItem(href, d.title ? `CRV #${registro} · ${d.title}` : `CRV #${registro}`, ctx),
    d.image && { label: tr("Abrir imagen"), icon: ImageIcon, run: () => window.open(d.image, "_blank", "noopener") },
    "separator",
    d.deaccessed !== undefined &&
      (deaccessed
        ? { label: tr("Devolver a inventario…"), icon: Undo2, run: () => changeStatus("reinstate") }
        : { label: tr("De-accessar…"), icon: Archive, run: () => changeStatus("deaccession") }),
    { label: tr("Eliminar obra…"), icon: Trash2, danger: true, run: remove },
  ];
};

const field: Builder = (el, ctx) => {
  const { label = "", value = "" } = el.dataset;
  if (!value) return [];
  return [copyItem(ctx.tr("Copiar «{label}»", { label }), value, ctx)];
};

const portfolio: Builder = (el, ctx) => {
  const { tr, router } = ctx;
  const { base = "", parentRef } = el.dataset;
  const href = `/admin/portfolios/${encodeURIComponent(base)}`;
  return [
    { label: tr("Abrir portafolio"), icon: ArrowUpRight, run: () => router.push(href) },
    newWindowItem(href, tr),
    parentRef && {
      label: tr("Editar ficha del portafolio"),
      icon: Pencil,
      run: () => router.push(`/admin/artwork/${encodeURIComponent(parentRef)}`),
    },
    "separator",
    copyItem(tr("Copiar número CRV"), base, ctx, Hash),
    copyItem(tr("Copiar enlace"), absolute(href), ctx, LinkIcon),
    shareItem(href, el.dataset.title, ctx),
  ];
};

const page: Builder = (el, ctx) => {
  const { tr, router } = ctx;
  const { slug = "", publicHref } = el.dataset;
  const href = `/admin/content/${encodeURIComponent(slug)}`;
  return [
    { label: tr("Editar página"), icon: Pencil, run: () => router.push(href) },
    newWindowItem(href, tr),
    publicHref && { label: tr("Ver en el sitio"), icon: ExternalLink, run: () => openWindow(publicHref) },
    "separator",
    copyItem(tr("Copiar ruta"), `/${slug}`, ctx, LinkIcon),
  ];
};

/** Column headers: pick the order without hunting for the arrow. */
const sort: Builder = (el, ctx) => {
  const { tr, router } = ctx;
  const key = el.dataset.sort ?? "";
  const params = new URLSearchParams(window.location.search);
  const active = (params.get("sort") ?? "registro") === key;
  const dir = params.get("dir") === "desc" ? "desc" : "asc";
  const go = (next: "asc" | "desc") => {
    params.set("sort", key);
    params.set("dir", next);
    params.delete("page");
    router.push(`${window.location.pathname}?${params}`);
  };
  return [
    { label: tr("Orden ascendente"), icon: SortAsc, checked: active && dir === "asc", run: () => go("asc") },
    { label: tr("Orden descendente"), icon: SortDesc, checked: active && dir === "desc", run: () => go("desc") },
  ];
};

/** The inventory's own surface, between and around the works. */
const inventory: Builder = (el, ctx) => {
  const { tr, router } = ctx;
  const { view, exportHref, filtered } = el.dataset;
  const params = new URLSearchParams(window.location.search);
  const viewHref = (next: "table" | "grid") => {
    if (next === "grid") params.set("view", "grid");
    else params.delete("view");
    params.delete("page");
    return `/inventory${params.size ? `?${params}` : ""}`;
  };
  return [
    { label: tr("Vista de tabla"), icon: Table2, checked: view !== "grid", run: () => router.push(viewHref("table")) },
    { label: tr("Vista de galería"), icon: LayoutGrid, checked: view === "grid", run: () => router.push(viewHref("grid")) },
    "separator",
    filtered === "1" && {
      label: tr("Quitar filtros"),
      icon: ListFilter,
      run: () => router.push(view === "grid" ? "/inventory?view=grid" : "/inventory"),
    },
    { label: tr("Nueva obra"), icon: FilePlus, run: () => router.push("/admin/artwork/new") },
    exportHref && { label: tr("Exportar CSV"), icon: Download, run: () => download(exportHref) },
    "separator",
    { label: tr("Recargar"), icon: RotateCw, run: () => router.refresh() },
  ];
};

const BUILDERS: Record<string, Builder> = { artwork, field, portfolio, page, sort, inventory };

export function linkItems(anchor: HTMLAnchorElement, ctx: MenuContext): MenuEntry[] {
  const { tr, router } = ctx;
  const url = new URL(anchor.href, window.location.href);
  const copy = copyItem(tr("Copiar enlace"), url.href, ctx, LinkIcon);

  if (anchor.hasAttribute("download") || url.pathname.startsWith("/api/")) {
    return [{ label: tr("Descargar"), icon: Download, run: () => download(url.href) }, copy];
  }
  if (url.origin !== window.location.origin) {
    return [{ label: tr("Abrir en el navegador"), icon: ExternalLink, run: () => window.open(url.href, "_blank", "noopener") }, copy];
  }
  const path = `${url.pathname}${url.search}${url.hash}`;
  return [
    { label: tr("Abrir"), icon: ArrowUpRight, run: () => router.push(path) },
    newWindowItem(path, tr),
    "separator",
    copy,
    shareItem(path, anchor.textContent?.trim() || undefined, ctx),
  ];
}

export function pageItems(ctx: MenuContext): MenuEntry[] {
  const { tr, router } = ctx;
  return [
    { label: tr("Atrás"), icon: ArrowLeft, disabled: window.history.length <= 1, run: () => router.back() },
    { label: tr("Adelante"), icon: ArrowRight, run: () => router.forward() },
    { label: tr("Recargar"), icon: RotateCw, run: () => router.refresh() },
    "separator",
    copyItem(tr("Copiar enlace de esta página"), window.location.href, ctx, LinkIcon),
    shareItem(`${window.location.pathname}${window.location.search}`, document.title, ctx),
  ];
}

/**
 * Items for a right-click on `target`, or null to leave it to the platform
 * (selected text outside any marked element keeps the native Copy menu).
 */
export function buildFromElement(
  target: Element,
  ctx: MenuContext,
  { hasSelection }: { hasSelection: boolean }
): MenuEntry[] | null {
  // A value inside a record adds its own line, then the record's menu follows.
  const groups: MenuEntry[][] = [];
  let el = target.closest<HTMLElement>("[data-ctx]");
  while (el) {
    const builder = BUILDERS[el.dataset.ctx ?? ""];
    if (builder) groups.push(builder(el, ctx));
    if (el.dataset.ctx !== "field") break;
    el = el.parentElement?.closest<HTMLElement>("[data-ctx]") ?? null;
  }
  if (groups.length > 0) return groups.flatMap((group, i) => (i === 0 ? group : ["separator" as const, ...group]));

  if (hasSelection) return null;

  const entries: MenuEntry[] = [];
  const anchor = target.closest<HTMLAnchorElement>("a[href]");
  if (anchor) entries.push(...linkItems(anchor, ctx));
  const image = target.closest("img");
  if (image?.currentSrc) {
    const src = image.currentSrc;
    entries.push(
      "separator",
      { label: ctx.tr("Abrir imagen"), icon: ImageIcon, run: () => window.open(src, "_blank", "noopener") },
      copyItem(ctx.tr("Copiar dirección de la imagen"), src, ctx, LinkIcon)
    );
  }
  return entries.length > 0 ? entries : pageItems(ctx);
}
