"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Award,
  Boxes,
  FileText,
  LayoutDashboard,
  MapPin,
  Layers,
  Palette,
  RefreshCw,
  Upload,
  Settings,
  Users,
  History,
  Clock,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useTr } from "@/components/I18nProvider";
import { useContextMenu } from "./ContextMenu";
import { newWindowItem } from "./context-menus";

const STORAGE_KEY = "crv_rail_collapsed";
const RAIL_EVENT = "crv:rail";

/**
 * The collapsed flag lives in localStorage, which is an external store — read
 * through useSyncExternalStore rather than an effect, so React stays in step
 * with it and the server render has a defined value.
 */
function subscribe(onChange: () => void) {
  window.addEventListener(RAIL_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(RAIL_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

const ITEMS = [
  { href: "/inventory", label: "Inventario", icon: Boxes },
  { href: "/admin", label: "Panel", icon: LayoutDashboard },
  { href: "/admin/artists", label: "Artistas", icon: Palette },
  { href: "/admin/portfolios", label: "Portafolios", icon: Layers },
  { href: "/admin/certificates", label: "Certificados", icon: Award },
  { href: "/admin/locations", label: "Ubicaciones", icon: MapPin },
  { href: "/admin/content", label: "Contenido", icon: FileText },
  { href: "/admin/import", label: "Importar", icon: Upload },
  { href: "/admin/sync", label: "Sincronizar", icon: RefreshCw },
  { href: "/admin/hours", label: "Horas", icon: Clock },
  { href: "/admin/history", label: "Historial", icon: History },
  { href: "/admin/users", label: "Usuarios", icon: Users },
  { href: "/admin/settings", label: "Ajustes", icon: Settings },
];

/** Marks /inventory active on /inventory/1071, without matching /admin on /admin/artists. */
function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin" || pathname.startsWith("/admin/artwork");
  return pathname === href || pathname.startsWith(`${href}/`);
}

type Tip = { label: string; top: number; left: number };

/**
 * Labels for the icon-only rail. Fixed-positioned from the icon's rect, so the
 * rail's own overflow cannot clip them. The first one waits a beat; moving
 * along the rail while one is showing swaps the label at once, the way native
 * toolbars behave.
 */
function useRailTip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warmUntil = useRef(0);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const show = useCallback((label: string, target: HTMLElement) => {
    clear();
    const rect = target.getBoundingClientRect();
    const next = { label, top: rect.top + rect.height / 2, left: rect.right + 10 };
    if (Date.now() < warmUntil.current) setTip(next);
    else timer.current = setTimeout(() => setTip(next), 350);
  }, []);

  const hide = useCallback(() => {
    clear();
    setTip((current) => {
      if (current) warmUntil.current = Date.now() + 400;
      return null;
    });
  }, []);

  useEffect(() => clear, []);

  return { tip, show, hide };
}

function RailTooltip({ tip }: { tip: Tip }) {
  return (
    <div
      aria-hidden
      style={{ top: tip.top, left: tip.left }}
      className="rail-tip pointer-events-none fixed z-[60] whitespace-nowrap rounded-[6px] bg-[#242424] px-2.5 py-1.5 text-xs font-semibold text-white shadow-[var(--shadow-16)]"
    >
      <span className="absolute -left-1 top-1/2 size-2 -translate-y-1/2 rotate-45 rounded-[1px] bg-[#242424]" />
      <span className="relative">{tip.label}</span>
    </div>
  );
}

export default function NavRail() {
  const tr = useTr();
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);
  const menu = useContextMenu();
  const { tip, show, hide } = useRailTip();

  // Labels only stand in for missing text: an expanded rail needs none.
  const tipProps = (label: string, always = false) =>
    collapsed || always
      ? {
          onMouseEnter: (event: React.MouseEvent<HTMLElement>) => show(label, event.currentTarget),
          onMouseLeave: hide,
          onFocus: (event: React.FocusEvent<HTMLElement>) => show(label, event.currentTarget),
          onBlur: hide,
        }
      : {};

  const toggle = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, readCollapsed() ? "0" : "1");
    } catch {
      /* private window or blocked storage: the rail just will not persist */
    }
    window.dispatchEvent(new Event(RAIL_EVENT));
  }, []);

  return (
    <nav
      aria-label={tr("Secciones")}
      onContextMenu={(event) => {
        const href = (event.target as Element).closest("a")?.getAttribute("href");
        menu(() => [
          href && { label: tr("Abrir"), run: () => router.push(href) },
          href && newWindowItem(href, tr),
          "separator",
          {
            label: collapsed ? tr("Expandir menú") : tr("Contraer menú"),
            icon: collapsed ? PanelLeftOpen : PanelLeftClose,
            run: toggle,
          },
        ])(event);
      }}
      onScroll={hide}
      data-collapsed={collapsed}
      // Inline width: a layout-critical dimension should not depend on an
      // arbitrary Tailwind utility being generated.
      style={{ width: collapsed ? "48px" : "var(--admin-rail-w)", minWidth: 0 }}
      // Pinned under the header at full window height, so it never scrolls
      // away with the page; a very short window scrolls the rail on its own.
      // (The nav itself is sticky: an overflow on it would trap a sticky child.)
      className="sticky top-[var(--admin-header-h)] hidden h-[calc(100vh-var(--admin-header-h))] shrink-0 self-start overflow-y-auto overflow-x-hidden border-r border-[var(--stroke-soft)] bg-[var(--surface)] transition-[width] duration-150 md:block"
    >
      <div>
        <div className={`flex p-2 pb-0 ${collapsed ? "justify-center" : "justify-end"}`}>
          <button
            type="button"
            onClick={() => {
              hide();
              toggle();
            }}
            aria-expanded={!collapsed}
            {...tipProps(collapsed ? tr("Expandir menú") : tr("Contraer menú"), true)}
            className="rounded-[var(--radius)] p-1.5 text-[var(--ink-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--ink-1)]"
          >
            {collapsed ? (
              <PanelLeftOpen size={18} strokeWidth={1.75} aria-hidden />
            ) : (
              <PanelLeftClose size={18} strokeWidth={1.75} aria-hidden />
            )}
            <span className="sr-only">{collapsed ? tr("Expandir menú") : tr("Contraer menú")}</span>
          </button>
        </div>
        <ul className="space-y-0.5 p-2">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                {...tipProps(tr(item.label))}
                className={`relative flex items-center gap-3 rounded-[var(--radius)] py-2 text-sm transition-colors ${
                  collapsed ? "justify-center px-2" : "px-3"
                } ${
                  active
                    ? "bg-[var(--selected)] font-semibold text-[var(--ink-1)]"
                    : "text-[var(--ink-2)] hover:bg-[var(--hover)] hover:text-[var(--ink-1)]"
                }`}
              >
                {/* Fluent marks the selected item with a brand bar, not just a fill. */}
                <span
                  aria-hidden
                  className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full ${
                    active ? "bg-[var(--brand)]" : "bg-transparent"
                  }`}
                />
                <Icon size={18} strokeWidth={1.75} aria-hidden className="shrink-0" />
                {collapsed ? <span className="sr-only">{tr(item.label)}</span> : tr(item.label)}
              </Link>
            </li>
          );
        })}
        </ul>
      </div>
      {tip && <RailTooltip key={tip.label} tip={tip} />}
    </nav>
  );
}
