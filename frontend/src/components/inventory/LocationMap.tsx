"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Download, MapPin, Search, X } from "lucide-react";
import {
  FLOORS,
  planRoomId,
  roomById,
  roomName,
  toView,
  type Floor,
  type PlanRoom,
  type Rect,
} from "@/lib/inventory/floorplan";
import type { MapPlace, MapWork } from "@/lib/inventory/location-map";
import { normalizeText } from "@/lib/inventory/fields";
import { useTr } from "@/components/I18nProvider";
import { useToast } from "./ToastProvider";

const FIELD =
  "rounded border border-[var(--stroke)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--ink-1)] outline-none transition placeholder:text-[var(--ink-4)] focus:border-[var(--brand)]";
const BTN =
  "inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40";
const HEADING =
  "border-b border-[var(--stroke-soft)] pb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]";

/** Space above each floor for its title, and between stacked floors. */
const TITLE_H = 56;
const GAP = 40;
const STREET_W = 70;
const FONT = "ui-sans-serif, system-ui, -apple-system, Helvetica, Arial, sans-serif";

async function post(body: Record<string, unknown>) {
  const response = await fetch("/api/admin/locations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "No se pudo guardar");
  return data;
}

function union(rects: Rect[]): Rect {
  const x1 = Math.min(...rects.map((r) => r.x));
  const y1 = Math.min(...rects.map((r) => r.y));
  const x2 = Math.max(...rects.map((r) => r.x + r.w));
  const y2 = Math.max(...rects.map((r) => r.y + r.h));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/** Where each floor sits in the stacked drawing. */
function layout(floors: Floor[]) {
  let y = 0;
  let width = 0;
  const placed = floors.map((floor) => {
    const view = union([floor.lot, ...floor.shell, ...floor.areas.flatMap((a) => a.rects)].map(toView));
    // Shift so the street gutter starts at x=0 and the title sits above.
    const dx = STREET_W - view.x;
    const dy = y + TITLE_H - view.y;
    y += TITLE_H + view.h + GAP;
    width = Math.max(width, STREET_W + view.w + 20);
    return { floor, dx, dy, view };
  });
  return { placed, width, height: y - GAP + 10 };
}

function floorLabel(floor: Floor, tr: (s: string) => string) {
  return `${floor.title} · ${tr(floor.subtitle)}`;
}

function roomLabel(roomId: string, tr: (s: string) => string): string {
  const ref = roomById(roomId);
  if (!ref) return roomId;
  return `${floorLabel(ref.floor, tr)} · ${ref.room.number} ${roomName(ref.room)}`;
}

export default function LocationMap({
  places,
  works,
  initialQuery,
  initialRoom,
  initialFloor,
}: {
  places: MapPlace[];
  works: MapWork[];
  initialQuery: string;
  initialRoom: string | null;
  initialFloor: string | null;
}) {
  const tr = useTr();
  const router = useRouter();
  const { notify } = useToast();
  const svgRef = useRef<SVGSVGElement>(null);

  const startRoom = initialRoom ? roomById(initialRoom) : null;
  /** One floor at a time fits the screen; "all" is the printable overview. */
  const [floorId, setFloorIdState] = useState<string>(
    initialFloor && (initialFloor === "all" || FLOORS.some((f) => f.id === initialFloor))
      ? initialFloor
      : startRoom?.floor.id ?? FLOORS[0].id
  );
  const [selected, setSelected] = useState<string | null>(startRoom ? initialRoom : null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [showCounts, setShowCounts] = useState(true);
  const [placing, setPlacing] = useState<MapPlace | null>(null);
  const [pending, setPending] = useState(false);
  /** How many thumbnails to show; starts over whenever another room is picked. */
  const [shown, setShown] = useState<{ room: string | null; limit: number }>({ room: null, limit: 60 });
  const workLimit = shown.room === selected ? shown.limit : 60;

  /** Keeps the floor in the URL, so a reload or a shared link opens the same one. */
  function setFloorId(id: string) {
    setFloorIdState(id);
    const url = new URL(window.location.href);
    url.searchParams.set("floor", id);
    window.history.replaceState(null, "", url);
  }

  // 1–3 switch floors, 0 shows all three, Escape backs out of placing or a selection.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "Escape") {
        if (placing) setPlacing(null);
        else setSelected(null);
        return;
      }
      if (event.key === "0") setFloorId("all");
      const floor = FLOORS[Number(event.key) - 1];
      if (floor) setFloorId(floor.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [placing]);

  const placeByKey = useMemo(() => new Map(places.map((p) => [p.key, p])), [places]);

  const placesByRoom = useMemo(() => {
    const map = new Map<string, MapPlace[]>();
    for (const place of places) {
      if (!place.roomId) continue;
      if (!map.has(place.roomId)) map.set(place.roomId, []);
      map.get(place.roomId)!.push(place);
    }
    for (const list of map.values()) list.sort((a, b) => b.count - a.count);
    return map;
  }, [places]);

  const countByRoom = useMemo(() => {
    const map = new Map<string, number>();
    for (const [room, list] of placesByRoom) map.set(room, list.reduce((sum, p) => sum + p.count, 0));
    return map;
  }, [placesByRoom]);

  const maxCount = Math.max(1, ...countByRoom.values());

  const worksByPlace = useMemo(() => {
    const map = new Map<string, MapWork[]>();
    for (const work of works) {
      if (!map.has(work.place)) map.set(work.place, []);
      map.get(work.place)!.push(work);
    }
    return map;
  }, [works]);

  const haystacks = useMemo(
    () => works.map((w) => normalizeText([w.registro, w.title, w.artist].filter(Boolean).join(" "))),
    [works]
  );

  const needle = normalizeText(query);
  const matches = useMemo(() => {
    if (needle.length < 2) return null;
    return works.filter((w, i) => w.registro === query.trim() || haystacks[i].includes(needle));
  }, [needle, query, works, haystacks]);

  const matchedRooms = useMemo(() => {
    if (!matches) return null;
    const rooms = new Set<string>();
    for (const work of matches) {
      const roomId = placeByKey.get(work.place)?.roomId;
      if (roomId) rooms.add(roomId);
    }
    return rooms;
  }, [matches, placeByKey]);

  const unplaced = places.filter((p) => !p.roomId && !p.offsite).sort((a, b) => b.count - a.count);
  const offsite = places.filter((p) => p.offsite).sort((a, b) => b.count - a.count);
  const onMap = places.filter((p) => p.roomId).reduce((sum, p) => sum + p.count, 0);
  const unplacedCount = unplaced.reduce((sum, p) => sum + p.count, 0);

  /** Works on each floor, and how many search hits each one holds. */
  const floorStats = useMemo(() => {
    const stats = new Map<string, { works: number; hits: number }>(FLOORS.map((f) => [f.id, { works: 0, hits: 0 }]));
    for (const [roomId, count] of countByRoom) {
      const ref = roomById(roomId);
      if (ref) stats.get(ref.floor.id)!.works += count;
    }
    for (const work of matches ?? []) {
      const ref = roomById(placeByKey.get(work.place)?.roomId ?? "");
      if (ref) stats.get(ref.floor.id)!.hits += 1;
    }
    return stats;
  }, [countByRoom, matches, placeByKey]);

  const floors = floorId === "all" ? FLOORS : FLOORS.filter((f) => f.id === floorId);
  const { placed, width, height } = layout(floors);

  function selectRoom(roomId: string) {
    const ref = roomById(roomId);
    if (ref && floorId !== ref.floor.id) setFloorId(ref.floor.id);
    setSelected(roomId);
  }

  async function assign(place: MapPlace, roomId: string | null) {
    setPending(true);
    try {
      await post({ action: "assign_room", key: place.key, roomId, label: place.canonical });
      notify(
        roomId
          ? tr("«{place}» ubicado en {room}", { place: place.canonical, room: roomLabel(roomId, tr) })
          : tr("«{place}» quitado del plano", { place: place.canonical })
      );
      router.refresh();
      if (roomId) setSelected(roomId);
    } catch (error) {
      notify(tr((error as Error).message), "error");
    }
    setPending(false);
    setPlacing(null);
  }

  function onRoomClick(roomId: string) {
    if (placing) {
      void assign(placing, roomId);
      return;
    }
    setSelected((current) => (current === roomId ? null : roomId));
  }

  /** The drawing as a standalone file, with theme colours resolved. */
  function serialize(): string | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const styles = getComputedStyle(document.documentElement);
    const markup = new XMLSerializer()
      .serializeToString(svg)
      .replace(/var\((--[a-z0-9-]+)\)/g, (_, name: string) => styles.getPropertyValue(name).trim() || "#888")
      // On screen it stretches to its box; as a file it carries its real size.
      .replace(/^<svg([^>]*?) width="100%"( height="100%")?/, `<svg$1 width="${width}" height="${height}"`);
    return `<?xml version="1.0" encoding="UTF-8"?>\n${markup}`;
  }

  function download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const fileBase = floorId === "all" ? "plano-480-482" : `plano-${floorId}`;

  function downloadSvg() {
    const markup = serialize();
    if (markup) download(new Blob([markup], { type: "image/svg+xml" }), `${fileBase}.svg`);
  }

  function downloadPng() {
    const markup = serialize();
    if (!markup) return;
    const image = new Image();
    const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
    image.onload = () => {
      // ~4000 px across: sharp enough to print the plan on a full sheet.
      const scale = 4000 / width;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => blob && download(blob, `${fileBase}.png`), "image/png");
    };
    image.src = url;
  }

  function renderRoom(floor: Floor, room: PlanRoom) {
    const id = planRoomId(floor, room);
    const rects = room.rects.map(toView);
    const box = rects.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a));
    const count = countByRoom.get(id) ?? 0;
    const isSelected = selected === id;
    const isHovered = hovered === id;
    const dimmed = matchedRooms ? !matchedRooms.has(id) : false;
    const matched = matchedRooms?.has(id) ?? false;

    const heat = showCounts && count > 0 ? 0.1 + 0.42 * Math.sqrt(count / maxCount) : 0;
    const fill = matched ? "var(--warning)" : count > 0 && showCounts ? "var(--brand)" : "var(--surface)";
    const fillOpacity = matched ? 0.35 : heat || 1;

    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const roomy = box.w >= 100 && box.h >= 90;
    const nameSize = Math.min(15, box.w / 9);
    const works = tr(count === 1 ? "{n} obra" : "{n} obras", { n: count });
    const name = roomName(room);

    return (
      <g
        key={id}
        role="button"
        tabIndex={0}
        aria-label={`${room.number} ${name}${count ? ` · ${works}` : ""}`}
        onClick={() => onRoomClick(id)}
        onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && onRoomClick(id)}
        onMouseEnter={() => setHovered(id)}
        onMouseLeave={() => setHovered((h) => (h === id ? null : h))}
        style={{ cursor: "pointer", outline: "none" }}
        opacity={dimmed ? 0.35 : 1}
      >
        <title>{`${room.number} · ${name}${count ? ` — ${works}` : ""}`}</title>
        {rects.map((rect, i) => (
          <rect key={`bg${i}`} x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill="var(--surface)" />
        ))}
        {rects.map((rect, i) => (
          <rect
            key={i}
            x={rect.x}
            y={rect.y}
            width={rect.w}
            height={rect.h}
            fill={fill}
            fillOpacity={fillOpacity}
            stroke={isSelected || (placing && isHovered) ? "var(--brand)" : "var(--ink-2)"}
            strokeWidth={isSelected || (placing && isHovered) ? 5 : isHovered ? 3 : 2}
          />
        ))}
        <circle cx={cx} cy={roomy ? cy - 18 : cy} r={15} fill="var(--surface)" stroke="var(--ink-2)" strokeWidth={1.5} />
        <text
          x={cx}
          y={roomy ? cy - 18 : cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={14}
          fontWeight={600}
          fill="var(--ink-1)"
        >
          {room.number}
        </text>
        {roomy && (
          <text x={cx} y={cy + 14} textAnchor="middle" fontSize={nameSize} fill="var(--ink-1)" fontWeight={500}>
            {name.toUpperCase()}
          </text>
        )}
        {roomy && showCounts && count > 0 && (
          <text x={cx} y={cy + 34} textAnchor="middle" fontSize={13} fill="var(--ink-2)">
            {works}
          </text>
        )}
        {!roomy && showCounts && count > 0 && (
          <text x={cx} y={cy + 30} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--ink-2)">
            {count}
          </text>
        )}
      </g>
    );
  }

  function renderFloor({ floor, dx, dy, view }: ReturnType<typeof layout>["placed"][number]) {
    const lot = toView(floor.lot);
    return (
      <g key={floor.id} transform={`translate(${dx} ${dy})`}>
        <text x={view.x - STREET_W + 4} y={view.y - TITLE_H + 30} fontSize={22} fontWeight={600} fill="var(--ink-1)">
          {floor.title}
          <tspan fontWeight={400} fill="var(--ink-3)">{`  ${tr(floor.subtitle)}`}</tspan>
        </text>
        <rect
          x={lot.x}
          y={lot.y}
          width={lot.w}
          height={lot.h}
          fill="none"
          stroke="var(--ink-3)"
          strokeWidth={1.5}
          strokeDasharray="10 6"
        />
        {floor.shell.map((rect, i) => {
          const v = toView(rect);
          return <rect key={i} x={v.x} y={v.y} width={v.w} height={v.h} fill="var(--surface)" stroke="none" />;
        })}
        {floor.areas.map((area, i) =>
          area.rects.map(toView).map((rect, j) => (
            <g key={`${i}-${j}`}>
              <rect
                x={rect.x}
                y={rect.y}
                width={rect.w}
                height={rect.h}
                fill={area.kind === "techo" ? "url(#plan-hatch)" : area.kind === "escalera" ? "url(#plan-steps)" : "none"}
                stroke="var(--ink-3)"
                strokeWidth={1}
                strokeDasharray={area.kind === "patio" ? "4 4" : undefined}
              />
              {j === 0 && area.name && rect.w >= 70 && rect.h >= 34 && area.kind !== "escalera" && (
                <text
                  x={rect.x + rect.w / 2}
                  y={rect.y + rect.h / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={12}
                  letterSpacing={1}
                  fill="var(--ink-3)"
                >
                  {area.name.toUpperCase()}
                </text>
              )}
            </g>
          ))
        )}
        {floor.rooms.map((room) => renderRoom(floor, room))}
        {floor.shell.map((rect, i) => {
          const v = toView(rect);
          return (
            <rect key={`w${i}`} x={v.x} y={v.y} width={v.w} height={v.h} fill="none" stroke="var(--ink-1)" strokeWidth={6} pointerEvents="none" />
          );
        })}
        {floor.spirals?.map((s, i) => {
          const c = toView({ x: s.cx, y: s.cy, w: 0, h: 0 });
          return (
            <g key={`s${i}`} pointerEvents="none">
              <circle cx={c.x} cy={c.y} r={s.r} fill="var(--surface)" stroke="var(--ink-2)" strokeWidth={1.5} />
              {Array.from({ length: 8 }, (_, k) => {
                const a = (k * Math.PI) / 4;
                return (
                  <line
                    key={k}
                    x1={c.x}
                    y1={c.y}
                    x2={c.x + s.r * Math.cos(a)}
                    y2={c.y + s.r * Math.sin(a)}
                    stroke="var(--ink-3)"
                    strokeWidth={1}
                  />
                );
              })}
            </g>
          );
        })}
        <text
          transform={`translate(${view.x - STREET_W + 34} ${lot.y + lot.h / 2}) rotate(-90)`}
          textAnchor="middle"
          fontSize={13}
          letterSpacing={2}
          fill="var(--ink-3)"
        >
          {tr("CALLE JOSÉ A. CANALS")}
        </text>
        <line
          x1={view.x - 16}
          y1={lot.y}
          x2={view.x - 16}
          y2={lot.y + lot.h}
          stroke="var(--ink-3)"
          strokeWidth={1}
        />
      </g>
    );
  }

  const selectedRef = selected ? roomById(selected) : null;
  const selectedPlaces = selected ? placesByRoom.get(selected) ?? [] : [];
  const selectedWorks = selectedPlaces.flatMap((p) => worksByPlace.get(p.key) ?? []);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-4)]" />
          <input
            className={`${FIELD} w-full pl-8`}
            placeholder={tr("Buscar obra por registro, título o artista…")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--ink-2)]">
          <input type="checkbox" checked={showCounts} onChange={(event) => setShowCounts(event.target.checked)} />
          {tr("Mostrar obras")}
        </label>
        <button type="button" onClick={downloadSvg} className={`${BTN} border-[var(--stroke)] text-[var(--ink-2)] hover:bg-[var(--hover)]`}>
          <Download className="h-4 w-4" /> SVG
        </button>
        <button type="button" onClick={downloadPng} className={`${BTN} border-[var(--stroke)] text-[var(--ink-2)] hover:bg-[var(--hover)]`}>
          <Download className="h-4 w-4" /> PNG
        </button>
      </div>

      <div className="grid gap-4 lg:h-[calc(100dvh-var(--admin-header-h,0px)-190px)] lg:min-h-[520px] lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-h-0 flex-col overflow-hidden rounded border border-[var(--stroke-soft)] bg-[var(--surface)]">
          <div role="tablist" aria-label={tr("Piso")} className="flex flex-wrap border-b border-[var(--stroke-soft)]">
            {[...FLOORS.map((f, i) => ({ id: f.id, title: f.title, subtitle: tr(f.subtitle), key: String(i + 1) })), { id: "all", title: tr("Los tres pisos"), subtitle: tr("para imprimir"), key: "0" }].map((option) => {
              const stats = floorStats.get(option.id);
              const active = floorId === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  title={tr("Atajo: tecla {key}", { key: option.key })}
                  onClick={() => setFloorId(option.id)}
                  className={`relative flex min-w-[150px] flex-1 flex-col items-start border-r border-[var(--stroke-soft)] px-4 py-2 text-left transition last:border-r-0 ${
                    active ? "bg-[var(--surface)]" : "bg-[var(--surface-alt)] hover:bg-[var(--hover)]"
                  }`}
                >
                  {active && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--brand)]" />}
                  <span className={`text-sm font-semibold ${active ? "text-[var(--ink-1)]" : "text-[var(--ink-2)]"}`}>
                    {option.title}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-[var(--ink-3)]">
                    {option.subtitle}
                    {stats && stats.works > 0 && <span className="tabular-nums">· {tr("{n} obras", { n: stats.works })}</span>}
                    {stats && matches && stats.hits > 0 && (
                      <span className="rounded-full bg-[var(--warning-soft)] px-1.5 font-medium tabular-nums text-[var(--warning)]">
                        {tr(stats.hits === 1 ? "{n} resultado" : "{n} resultados", { n: stats.hits })}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <div className={`relative min-h-0 flex-1 p-3 ${floorId === "all" ? "overflow-auto" : "overflow-hidden"}`}>
            {placing && (
              <div className="absolute inset-x-3 top-3 z-10 flex flex-wrap items-center gap-3 rounded border border-[var(--brand)] bg-[var(--brand-soft)] px-4 py-2 text-sm text-[var(--ink-1)] shadow-[var(--shadow-8)]">
                <MapPin className="h-4 w-4 text-[var(--brand)]" />
                <span className="min-w-0 flex-1">
                  {tr("Haz clic en la sala donde está «{place}» ({n} obras).", { place: placing.canonical, n: placing.count })}
                  <span className="ml-1 text-[var(--ink-3)]">{tr("Cambia de piso con las pestañas o las teclas 1–3.")}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setPlacing(null)}
                  className={`${BTN} border-[var(--stroke)] bg-[var(--surface)] text-[var(--ink-2)] hover:bg-[var(--hover)]`}
                >
                  {tr("Cancelar")}
                </button>
              </div>
            )}
            <svg
              ref={svgRef}
              xmlns="http://www.w3.org/2000/svg"
              viewBox={`0 0 ${width} ${height}`}
              width="100%"
              height={floorId === "all" ? undefined : "100%"}
              fontFamily={FONT}
              role="img"
              aria-label={tr("Plano de ubicaciones")}
              style={{ display: "block", opacity: pending ? 0.6 : 1 }}
            >
              <defs>
                <pattern id="plan-hatch" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="12" stroke="var(--stroke)" strokeWidth="2" />
                </pattern>
                <pattern id="plan-steps" width="14" height="14" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="14" stroke="var(--ink-3)" strokeWidth="1.5" />
                </pattern>
              </defs>
              <rect x={0} y={0} width={width} height={height} fill="var(--surface)" />
              {placed.map(renderFloor)}
            </svg>
          </div>
        </div>

        <aside className="min-h-0 space-y-6 overflow-y-auto rounded border border-[var(--stroke-soft)] bg-[var(--surface)] p-4">
          {matches ? (
            <section>
              <h2 className={HEADING}>{tr("Resultados · {n}", { n: matches.length })}</h2>
              <ul className="mt-2 divide-y divide-[var(--stroke-soft)]">
                {matches.slice(0, 100).map((work) => {
                  const place = placeByKey.get(work.place);
                  return (
                    <li key={work.registro}>
                      <button
                        type="button"
                        onClick={() => {
                          // A hit in a drawer that is not on the map yet: go straight to placing it.
                          if (place?.roomId) selectRoom(place.roomId);
                          else if (place && !place.offsite) setPlacing(place);
                        }}
                        className="flex w-full items-center gap-3 py-2 text-left hover:bg-[var(--hover)]"
                      >
                        <Thumb src={work.thumb} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-[var(--ink-1)]">
                            <span className="mr-1.5 font-mono text-xs text-[var(--ink-3)]">#{work.registro}</span>
                            {work.title || tr("Sin título")}
                          </span>
                          <span className="block truncate text-xs text-[var(--ink-3)]">
                            {place?.roomId ? roomLabel(place.roomId, tr) : `${tr("Sin sala")} · ${place?.canonical ?? ""}`}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {matches.length > 100 && (
                <p className="mt-2 text-xs text-[var(--ink-3)]">{tr("Se muestran 100; afina la búsqueda.")}</p>
              )}
            </section>
          ) : null}

          {selectedRef && selected ? (
            <section>
              <div className="flex items-start justify-between gap-3 border-b border-[var(--stroke-soft)] pb-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-3)]">
                    {floorLabel(selectedRef.floor, tr)}
                  </p>
                  <h2 className="text-xl leading-tight text-[var(--ink-1)]">
                    {selectedRef.room.number} · {roomName(selectedRef.room)}
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label={tr("Cerrar")}
                  onClick={() => setSelected(null)}
                  className="rounded p-1 text-[var(--ink-3)] hover:bg-[var(--hover)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {selectedPlaces.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--ink-3)]">
                  {tr("No hay obras registradas en esta sala. Para ubicar aquí una gaveta o caja, elígela en «Sin sala en el plano».")}
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-[var(--stroke-soft)]">
                  {selectedPlaces.map((place) => (
                    <li key={place.key} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                      <Link
                        href={`/inventory?location=${encodeURIComponent(place.canonical)}`}
                        className="min-w-0 flex-1 truncate text-[var(--ink-1)] underline-offset-2 hover:underline"
                      >
                        {place.canonical}
                      </Link>
                      <span className="text-xs tabular-nums text-[var(--ink-3)]">{place.count}</span>
                      {place.source === "asignada" && (
                        <>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => setPlacing(place)}
                            className="text-xs font-medium text-[var(--ink-2)] underline-offset-2 hover:underline"
                          >
                            {tr("Mover")}
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => assign(place, null)}
                            className="text-xs font-medium text-[var(--danger)] underline-offset-2 hover:underline"
                          >
                            {tr("Quitar")}
                          </button>
                        </>
                      )}
                      {place.source === "registro" && (
                        <span
                          className="rounded bg-[var(--hover)] px-1.5 py-0.5 text-[11px] text-[var(--ink-3)]"
                          title={tr("La sala viene escrita en la columna «Localización»")}
                        >
                          {tr("según registro")}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {selectedWorks.length > 0 && (
                <>
                  <h3 className={`${HEADING} mt-5`}>{tr("Obras · {n}", { n: selectedWorks.length })}</h3>
                  <ul className="mt-2 grid grid-cols-3 gap-2">
                    {selectedWorks.slice(0, workLimit).map((work) => (
                      <li key={work.registro}>
                        <Link
                          href={`/inventory/${encodeURIComponent(work.registro)}`}
                          className="group block"
                          title={`#${work.registro} · ${work.title ?? ""} · ${work.artist}`}
                        >
                          <span className="block aspect-square overflow-hidden rounded border border-[var(--stroke-soft)] bg-[var(--surface-alt)]">
                            {work.thumb ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={work.thumb} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
                            ) : (
                              <span className="flex h-full items-center justify-center font-mono text-xs text-[var(--ink-4)]">
                                #{work.registro}
                              </span>
                            )}
                          </span>
                          <span className="mt-1 block truncate text-[11px] text-[var(--ink-2)]">{work.artist || work.title}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {selectedWorks.length > workLimit && (
                    <button
                      type="button"
                      onClick={() => setShown({ room: selected, limit: workLimit + 120 })}
                      className={`${BTN} mt-3 w-full justify-center border-[var(--stroke)] text-[var(--ink-2)] hover:bg-[var(--hover)]`}
                    >
                      {tr("Ver más ({n})", { n: selectedWorks.length - workLimit })}
                    </button>
                  )}
                </>
              )}
            </section>
          ) : null}

          {!selected && !matches && (
            <>
              <dl className="grid grid-cols-2 gap-3">
                {[
                  { label: tr("Obras en el plano"), value: onMap },
                  { label: tr("Sin sala en el plano"), value: unplacedCount },
                ].map((stat) => (
                  <div key={stat.label}>
                    <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-3)]">{stat.label}</dt>
                    <dd className="mt-0.5 text-lg font-semibold leading-none text-[var(--ink-1)]">{stat.value}</dd>
                  </div>
                ))}
              </dl>
              <section>
                <h2 className={HEADING}>{tr("Sin sala en el plano · {n}", { n: unplaced.length })}</h2>
                <p className="mt-2 text-sm text-[var(--ink-3)]">
                  {tr("Gavetas, cajas y lugares escritos sin número de sala. Pulsa «Ubicar» y luego la sala en el plano; se recuerda para todas sus obras.")}
                </p>
                <ul className="mt-2 divide-y divide-[var(--stroke-soft)]">
                  {unplaced.map((place) => (
                    <li key={place.key} className="flex items-center gap-2 py-1.5 text-sm">
                      <span className="min-w-0 flex-1 truncate text-[var(--ink-1)]">{place.canonical}</span>
                      <span className="text-xs tabular-nums text-[var(--ink-3)]">{place.count}</span>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => setPlacing(place)}
                        className={`${BTN} px-2 py-0.5 text-xs ${
                          placing?.key === place.key
                            ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--on-brand)]"
                            : "border-[var(--stroke)] text-[var(--ink-2)] hover:bg-[var(--hover)]"
                        }`}
                      >
                        <MapPin className="h-3 w-3" /> {tr("Ubicar")}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              {offsite.length > 0 && (
                <details>
                  <summary className={`${HEADING} cursor-pointer`}>
                    {tr("Fuera de 480/482 · {n}", { n: offsite.length })}
                  </summary>
                  <ul className="mt-2 divide-y divide-[var(--stroke-soft)]">
                    {offsite.map((place) => (
                      <li key={place.key} className="flex items-center gap-2 py-1.5 text-sm">
                        <span className="min-w-0 flex-1 truncate text-[var(--ink-2)]">{place.canonical}</span>
                        <span className="text-xs tabular-nums text-[var(--ink-3)]">{place.count}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function Thumb({ src }: { src: string | null }) {
  return (
    <span className="block h-10 w-10 shrink-0 overflow-hidden rounded border border-[var(--stroke-soft)] bg-[var(--surface-alt)]">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : null}
    </span>
  );
}
