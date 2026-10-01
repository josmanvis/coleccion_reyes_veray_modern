"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import type { PlacementSource } from "@/lib/inventory/location-map";
import { useTr } from "@/components/I18nProvider";
import { useToast } from "./ToastProvider";
import { useMenuConfirm } from "./ContextMenu";
import { MUTED } from "./ui";

const PAD = 16;

function union(rects: Rect[]): Rect {
  const x1 = Math.min(...rects.map((r) => r.x));
  const y1 = Math.min(...rects.map((r) => r.y));
  const x2 = Math.max(...rects.map((r) => r.x + r.w));
  const y2 = Math.max(...rects.map((r) => r.y + r.h));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

function largest(rects: Rect[]): Rect {
  return rects.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a));
}

/**
 * One work's place on the floor plan. The room is marked when known; when it
 * is not, the building is still drawn and clicking a room puts the place
 * there. A room read from the «Localización» text itself is not reassigned
 * here — the text decides it, so the cell is what to correct.
 */
export default function ArtworkPlanView({
  floorIds,
  placeKey,
  raw,
  roomId,
  source,
}: {
  floorIds: string[];
  placeKey: string;
  raw: string;
  roomId: string | null;
  source: PlacementSource | null;
}) {
  const tr = useTr();
  const router = useRouter();
  const { notify } = useToast();
  const confirm = useMenuConfirm();
  const floors = FLOORS.filter((floor) => floorIds.includes(floor.id));
  const current = roomId ? roomById(roomId) : null;
  const [floorId, setFloorId] = useState(current?.floor.id ?? floors[0]?.id);
  const [hovered, setHovered] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const floor = floors.find((f) => f.id === floorId) ?? floors[0];
  const editable = source !== "registro";

  async function assign(id: string | null) {
    const target = id ? roomById(id) : null;
    const ok = await confirm(
      target
        ? {
            title: tr("¿Colocar «{place}» en {room}?", {
              place: raw,
              room: `${target.room.number} ${roomName(target.room)}`,
            }),
            body: tr("Se aplica a todas las obras guardadas en «{place}». La columna Localización no cambia.", { place: raw }),
            confirmLabel: tr("Colocar"),
          }
        : {
            title: tr("¿Quitar «{place}» del plano?", { place: raw }),
            confirmLabel: tr("Quitar"),
            tone: "danger",
          }
    );
    if (!ok) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign_room", key: placeKey, roomId: id, label: raw }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "No se pudo guardar");
      notify(target ? tr("Ubicado en {room}", { room: `${target.room.number} ${roomName(target.room)}` }) : tr("Quitado del plano"));
      router.refresh();
    } catch (error) {
      notify(tr((error as Error).message), "error");
    }
    setBusy(false);
  }

  if (!floor) return null;

  return (
    <>
      {current ? (
        <>
          <p className="mt-3 text-sm font-semibold text-[var(--ink-1)]">
            {current.room.number} · {roomName(current.room)}
          </p>
          <p className={`text-xs ${MUTED}`}>
            {current.floor.title} · {tr(current.floor.subtitle)} · «{raw}»
          </p>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm text-[var(--ink-1)]">{raw}</p>
          <p className="mt-0.5 text-xs text-[var(--warning)]">
            {tr("Aún sin sala en el plano. Haz clic en la sala donde está.")}
          </p>
        </>
      )}

      {floors.length > 1 && (
        <div role="tablist" className="mt-3 flex gap-1">
          {floors.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={f.id === floor.id}
              onClick={() => setFloorId(f.id)}
              className={`rounded px-2 py-1 text-xs font-semibold transition-colors ${
                f.id === floor.id
                  ? "bg-[var(--brand-soft)] text-[var(--brand-hover)]"
                  : "text-[var(--ink-3)] hover:bg-[var(--hover)]"
              }`}
            >
              {f.building} · {tr(f.subtitle)}
              {current?.floor.id === f.id && " •"}
            </button>
          ))}
        </div>
      )}

      <FloorSvg
        floor={floor}
        markedId={current && current.floor.id === floor.id ? roomId : null}
        hovered={hovered}
        clickable={editable && !busy}
        onHover={setHovered}
        onPick={(id) => id !== roomId && assign(id)}
        tr={tr}
      />

      <div className={`mt-1 flex items-center gap-2 text-[11px] ${MUTED}`}>
        <span>
          {hovered && roomById(hovered)
            ? `${roomById(hovered)!.room.number} · ${roomName(roomById(hovered)!.room)}`
            : tr("La calle José A. Canals queda a la izquierda.")}
        </span>
        {source === "asignada" && (
          <button
            type="button"
            onClick={() => assign(null)}
            disabled={busy}
            className="ml-auto text-[var(--ink-3)] underline-offset-2 hover:text-[var(--danger)] hover:underline"
          >
            {tr("Quitar del plano")}
          </button>
        )}
      </div>
      {source === "registro" && (
        <p className={`mt-1 text-[11px] ${MUTED}`}>{tr("La sala sale del texto de Localización; para cambiarla, corrige ese campo.")}</p>
      )}
    </>
  );
}

function FloorSvg({
  floor,
  markedId,
  hovered,
  clickable,
  onHover,
  onPick,
  tr,
}: {
  floor: Floor;
  markedId: string | null;
  hovered: string | null;
  clickable: boolean;
  onHover: (id: string | null) => void;
  onPick: (id: string) => void;
  tr: (es: string, vars?: Record<string, string | number>) => string;
}) {
  const view = union([floor.lot, ...floor.shell, ...floor.areas.flatMap((a) => a.rects)].map(toView));
  const lot = toView(floor.lot);
  const marked = markedId ? roomById(markedId) : null;
  const pin = marked ? largest(marked.room.rects.map(toView)) : null;

  const renderRoom = (room: PlanRoom) => {
    const id = planRoomId(floor, room);
    const isMarked = id === markedId;
    const isHover = clickable && hovered === id;
    const rects = room.rects.map(toView);
    const box = largest(rects);
    return (
      <g
        key={id}
        onMouseEnter={() => onHover(id)}
        onMouseLeave={() => onHover(null)}
        onClick={clickable ? () => onPick(id) : undefined}
        style={{ cursor: clickable ? "pointer" : "default" }}
        role={clickable ? "button" : undefined}
        aria-label={`${room.number} ${roomName(room)}`}
      >
        <title>{`${room.number} · ${roomName(room)}`}</title>
        {rects.map((rect, i) => (
          <rect
            key={i}
            x={rect.x}
            y={rect.y}
            width={rect.w}
            height={rect.h}
            fill={isMarked || isHover ? "var(--brand)" : "var(--surface)"}
            fillOpacity={isMarked ? 0.28 : isHover ? 0.14 : 1}
            stroke={isMarked ? "var(--brand)" : "var(--ink-3)"}
            strokeWidth={isMarked ? 4 : 1.5}
          />
        ))}
        {!isMarked && (
          <text
            x={box.x + box.w / 2}
            y={box.y + box.h / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={14}
            fill={isHover ? "var(--brand-hover)" : "var(--ink-3)"}
            pointerEvents="none"
          >
            {room.number}
          </text>
        )}
      </g>
    );
  };

  return (
    <svg
      viewBox={`${view.x - PAD} ${view.y - PAD} ${view.w + PAD * 2} ${view.h + PAD * 2}`}
      className="mt-2 h-auto w-full"
      role="img"
      aria-label={tr("Plano: {room}", { room: `${floor.title} · ${tr(floor.subtitle)}` })}
    >
      <rect x={view.x - PAD} y={view.y - PAD} width={view.w + PAD * 2} height={view.h + PAD * 2} fill="var(--surface)" />
      <rect x={lot.x} y={lot.y} width={lot.w} height={lot.h} fill="none" stroke="var(--ink-3)" strokeWidth={1.5} strokeDasharray="10 6" />
      {floor.areas.map((area, i) =>
        area.rects.map(toView).map((rect, j) => (
          <rect
            key={`a${i}-${j}`}
            x={rect.x}
            y={rect.y}
            width={rect.w}
            height={rect.h}
            fill="none"
            stroke="var(--ink-4)"
            strokeWidth={1}
            strokeDasharray={area.kind === "patio" ? "4 4" : undefined}
          />
        ))
      )}
      {floor.rooms.map(renderRoom)}
      {floor.shell.map((rect, i) => {
        const v = toView(rect);
        return (
          <rect key={`w${i}`} x={v.x} y={v.y} width={v.w} height={v.h} fill="none" stroke="var(--ink-1)" strokeWidth={6} pointerEvents="none" />
        );
      })}
      {pin && marked && (
        <g transform={`translate(${pin.x + pin.w / 2} ${pin.y + pin.h / 2})`} pointerEvents="none">
          <circle r={22} fill="var(--brand)" stroke="var(--surface)" strokeWidth={4} />
          <text textAnchor="middle" dominantBaseline="central" fontSize={18} fontWeight={700} fill="var(--on-brand, #fff)">
            {marked.room.number}
          </text>
        </g>
      )}
    </svg>
  );
}
