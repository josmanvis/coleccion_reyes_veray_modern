"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import RichText from "./RichText";
import {
  BLOCK_LABELS,
  emptyBlock,
  type Block,
  type BlockType,
  type PageRow,
} from "@/lib/inventory/blocks";
import ConfirmDialog from "./ConfirmDialog";
import ImagePicker from "./ImagePicker";
import { useToast } from "./ToastProvider";
import { useTr } from "@/components/I18nProvider";

const FIELD =
  "w-full rounded border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink-1)] outline-none transition placeholder:text-[var(--ink-4)] focus:border-[var(--brand)]";
const BTN =
  "rounded border px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40";

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-xs font-medium text-[var(--ink-3)]">{children}</span>;
}

/** Editor for one block, switching on its type. */
function BlockFields({
  block,
  onChange,
  onPickImage,
  onPickGallery,
}: {
  block: Block;
  onChange: (content: Record<string, unknown>) => void;
  onPickImage: () => void;
  onPickGallery: () => void;
}) {
  const tr = useTr();
  const c = block.content;
  const set = (patch: Record<string, unknown>) => onChange({ ...c, ...patch });

  switch (block.type) {
    case "heading":
      return (
        <div className="grid gap-3 sm:grid-cols-[110px_1fr]">
          <label>
            <Label>{tr("Nivel")}</Label>
            <select
              value={String(c.level ?? "h2")}
              onChange={(e) => set({ level: e.target.value })}
              className={FIELD}
            >
              <option value="h1">{tr("H1")}</option>
              <option value="h2">{tr("H2")}</option>
              <option value="h3">{tr("H3")}</option>
            </select>
          </label>
          <label>
            <Label>{tr("Texto")}</Label>
            <input
              type="text"
              value={String(c.text ?? "")}
              onChange={(e) => set({ text: e.target.value })}
              className={FIELD}
            />
          </label>
        </div>
      );

    case "text":
      return (
        <div>
          <Label>{tr("Texto")}</Label>
          <RichText value={String(c.html ?? "")} onChange={(html) => set({ html })} />
        </div>
      );

    case "image":
      return (
        <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
          <div>
            <Label>{tr("Imagen")}</Label>
            <div className="relative aspect-square overflow-hidden rounded border border-[var(--stroke)] bg-[var(--hover)]">
              {c.url ? (
                <Image
                  src={String(c.url)}
                  alt=""
                  fill
                  sizes="160px"
                  className="object-contain"
                  unoptimized
                />
              ) : (
                <span className="flex size-full items-center justify-center text-xs text-[var(--ink-3)]">
                  
                  {tr("Sin imagen")}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onPickImage}
              className={`${BTN} mt-2 w-full border-[var(--stroke)] text-[var(--ink-1)] hover:bg-[var(--hover)] focus-visible:outline-[var(--brand)]`}
            >
              {c.url ? tr("Cambiar") : tr("Elegir imagen")}
            </button>
          </div>
          <div className="space-y-3">
            <label className="block">
              <Label>{tr("Texto alternativo")}</Label>
              <input
                type="text"
                value={String(c.alt ?? "")}
                onChange={(e) => set({ alt: e.target.value })}
                className={FIELD}
              />
            </label>
            <label className="block">
              <Label>{tr("Pie de foto")}</Label>
              <input
                type="text"
                value={String(c.caption ?? "")}
                onChange={(e) => set({ caption: e.target.value })}
                className={FIELD}
              />
            </label>
          </div>
        </div>
      );

    case "gallery": {
      const images = Array.isArray(c.images) ? (c.images as Array<Record<string, unknown>>) : [];
      return (
        <div>
          <Label>{tr(images.length === 1 ? "{n} imagen" : "{n} imágenes", { n: images.length })}</Label>
          {images.length > 0 && (
            <ul className="mb-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {images.map((img, i) => (
                <li key={i} className="group relative">
                  <span className="relative block aspect-square overflow-hidden rounded border border-[var(--stroke)] bg-[var(--hover)]">
                    <Image
                      src={String(img.url ?? "")}
                      alt=""
                      fill
                      sizes="120px"
                      className="object-contain"
                      unoptimized
                    />
                  </span>
                  <button
                    type="button"
                    aria-label={tr("Quitar imagen")}
                    onClick={() => set({ images: images.filter((_, j) => j !== i) })}
                    className="absolute -right-1 -top-1 rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-1.5 text-xs text-[var(--ink-2)] shadow-sm hover:border-red-400 hover:text-red-700"
                  >
                    
                    {tr("×")}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={onPickGallery}
            className={`${BTN} border-[var(--stroke)] text-[var(--ink-1)] hover:bg-[var(--hover)] focus-visible:outline-[var(--brand)]`}
          >
            
            {tr("Añadir imágenes")}
          </button>
        </div>
      );
    }

    case "cta":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <Label>{tr("Texto del enlace")}</Label>
            <input
              type="text"
              value={String(c.text ?? "")}
              onChange={(e) => set({ text: e.target.value })}
              className={FIELD}
            />
          </label>
          <label>
            <Label>{tr("Destino")}</Label>
            <input
              type="text"
              value={String(c.link ?? "")}
              onChange={(e) => set({ link: e.target.value })}
              placeholder={tr("/gallery")}
              className={FIELD}
            />
          </label>
        </div>
      );

    case "spacer":
      return (
        <label className="block max-w-[200px]">
          <Label>{tr("Altura (px)")}</Label>
          <input
            type="number"
            value={Number(c.height ?? 40)}
            onChange={(e) => set({ height: Number(e.target.value) || 0 })}
            className={FIELD}
          />
        </label>
      );

    default:
      return <p className="text-sm text-[var(--ink-3)]">{tr("Sin opciones.")}</p>;
  }
}

export default function PageEditor({ page }: { page: PageRow }) {
  const tr = useTr();
  const router = useRouter();
  const { notify } = useToast();

  const [draft, setDraft] = useState<PageRow>(page);
  const [pending, setPending] = useState(false);
  const [asking, setAsking] = useState<"save" | "delete" | null>(null);
  const [picker, setPicker] = useState<{ index: number; multiple: boolean } | null>(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(page);

  function setField<K extends keyof PageRow>(key: K, value: PageRow[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function setBlocks(blocks: Block[]) {
    setDraft((current) => ({ ...current, blocks }));
  }

  function addBlock(type: BlockType) {
    setBlocks([...draft.blocks, emptyBlock(type)]);
  }

  function moveBlock(index: number, delta: number) {
    const next = [...draft.blocks];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setBlocks(next);
  }

  async function save() {
    setPending(true);
    const response = await fetch(`/api/admin/content/${encodeURIComponent(page.slug)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: draft.title,
        slug: draft.slug,
        description: draft.description,
        status: draft.status,
        blocks: draft.blocks,
        meta_title: draft.meta_title,
        meta_description: draft.meta_description,
        nav_label: draft.nav_label,
      }),
    });

    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      notify(tr("Página \"{title}\" guardada", { title: body.title }));
      if (body.slug !== page.slug) router.replace(`/admin/content/${body.slug}`);
      router.refresh();
    } else {
      notify(tr(body.error || "No se pudo guardar"), "error");
    }
    setPending(false);
    setAsking(null);
  }

  async function remove() {
    setPending(true);
    const response = await fetch(`/api/admin/content/${encodeURIComponent(page.slug)}`, {
      method: "DELETE",
    });
    if (response.ok) {
      notify(tr("Página \"{title}\" eliminada", { title: page.title }));
      router.push("/admin/content");
      router.refresh();
    } else {
      const body = await response.json().catch(() => ({}));
      notify(tr(body.error || "No se pudo eliminar"), "error");
      setPending(false);
      setAsking(null);
    }
  }

  return (
    <>
      <div className="sticky top-[var(--admin-header-h)] z-30 -mx-5 mb-6 flex flex-wrap items-center gap-3 border-b border-[var(--stroke-soft)] bg-[var(--surface)] px-5 py-3 backdrop-blur">
        <span className="text-sm text-[var(--ink-3)]">
          {dirty ? tr("Cambios sin guardar") : tr("Sin cambios")}
        </span>
        <span
          className={`rounded border px-2 py-0.5 text-xs font-medium ${
            draft.status === "published"
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-[var(--stroke)] bg-[var(--hover)] text-[var(--ink-2)]"
          }`}
        >
          {draft.status === "published" ? tr("Publicada") : tr("Borrador")}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {draft.status === "published" && (
            <Link
              href={`/${draft.slug}`}
              className={`${BTN} border-[var(--stroke)] text-[var(--ink-2)] hover:bg-[var(--hover)] focus-visible:outline-[var(--brand)]`}
            >
              
              {tr("Ver en el sitio")}
            </Link>
          )}
          <button
            type="button"
            onClick={() =>
              setField("status", draft.status === "published" ? "draft" : "published")
            }
            className={`${BTN} border-[var(--stroke)] text-[var(--ink-1)] hover:bg-[var(--hover)] focus-visible:outline-[var(--brand)]`}
          >
            {draft.status === "published" ? tr("Pasar a borrador") : tr("Publicar")}
          </button>
          <button
            type="button"
            disabled={!dirty || pending}
            onClick={() => setAsking("save")}
            className={`${BTN} border-[var(--brand)] bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] focus-visible:outline-[var(--brand)]`}
          >
            
            {tr("Guardar")}
          </button>
        </div>
      </div>

      <section className="mb-8 grid gap-4 rounded border border-[var(--stroke-soft)] bg-[var(--surface)] p-4 sm:grid-cols-2">
        <label>
          <Label>{tr("Título")}</Label>
          <input
            type="text"
            value={draft.title}
            onChange={(e) => setField("title", e.target.value)}
            className={FIELD}
          />
        </label>
        <label>
          <Label>{tr("Slug (dirección pública)")}</Label>
          <input
            type="text"
            value={draft.slug}
            onChange={(e) => setField("slug", e.target.value)}
            className={`${FIELD} font-mono`}
          />
        </label>
        <label className="sm:col-span-2">
          <Label>{tr("Descripción corta")}</Label>
          <input
            type="text"
            value={draft.description ?? ""}
            onChange={(e) => setField("description", e.target.value)}
            className={FIELD}
          />
        </label>
        <label>
          <Label>{tr("Meta título (SEO)")}</Label>
          <input
            type="text"
            value={draft.meta_title ?? ""}
            onChange={(e) => setField("meta_title", e.target.value)}
            className={FIELD}
          />
        </label>
        <label>
          <Label>{tr("Meta descripción (SEO)")}</Label>
          <input
            type="text"
            value={draft.meta_description ?? ""}
            onChange={(e) => setField("meta_description", e.target.value)}
            className={FIELD}
          />
        </label>
      </section>

      <ol className="space-y-4">
        {draft.blocks.map((block, index) => (
          <li key={index} className="rounded border border-[var(--stroke-soft)] bg-[var(--surface)]">
            <header className="flex items-center gap-2 border-b border-[var(--stroke-soft)] px-4 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">
                {tr(BLOCK_LABELS[block.type] ?? block.type)}
              </span>
              <span className="text-xs text-[var(--ink-4)]">#{index + 1}</span>
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  aria-label={tr("Subir bloque")}
                  disabled={index === 0}
                  onClick={() => moveBlock(index, -1)}
                  className="rounded px-2 py-1 text-sm text-[var(--ink-2)] transition hover:bg-[var(--hover)] disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={tr("Bajar bloque")}
                  disabled={index === draft.blocks.length - 1}
                  onClick={() => moveBlock(index, 1)}
                  className="rounded px-2 py-1 text-sm text-[var(--ink-2)] transition hover:bg-[var(--hover)] disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => setBlocks(draft.blocks.filter((_, i) => i !== index))}
                  className="rounded px-2 py-1 text-sm text-red-700 transition hover:bg-red-50"
                >
                  
                  {tr("Quitar")}
                </button>
              </div>
            </header>
            <div className="p-4">
              <BlockFields
                block={block}
                onChange={(content) =>
                  setBlocks(draft.blocks.map((b, i) => (i === index ? { ...b, content } : b)))
                }
                onPickImage={() => setPicker({ index, multiple: false })}
                onPickGallery={() => setPicker({ index, multiple: true })}
              />
            </div>
          </li>
        ))}
      </ol>

      {draft.blocks.length === 0 && (
        <p className="rounded border border-dashed border-[var(--stroke)] px-4 py-10 text-center text-sm text-[var(--ink-3)]">
          
          {tr("Esta página todavía no tiene contenido. Añade un bloque para empezar.")}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-[var(--stroke-soft)] pt-6">
        <span className="text-xs font-medium text-[var(--ink-3)]">{tr("Añadir bloque:")}</span>
        {(Object.keys(BLOCK_LABELS) as BlockType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => addBlock(type)}
            className={`${BTN} border-[var(--stroke)] text-[var(--ink-1)] hover:bg-[var(--hover)] focus-visible:outline-[var(--brand)]`}
          >
            + {tr(BLOCK_LABELS[type])}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAsking("delete")}
          className={`${BTN} ml-auto border-red-300 text-red-800 hover:border-red-500 hover:bg-red-50 focus-visible:outline-red-700`}
        >
          
          {tr("Eliminar página")}
        </button>
      </div>

      <ImagePicker
        open={picker !== null}
        multiple={picker?.multiple ?? false}
        onClose={() => setPicker(null)}
        onPick={(urls) => {
          if (!picker) return;
          setBlocks(
            draft.blocks.map((b, i) => {
              if (i !== picker.index) return b;
              if (b.type === "gallery") {
                const existing = Array.isArray(b.content.images)
                  ? (b.content.images as Array<Record<string, unknown>>)
                  : [];
                return {
                  ...b,
                  content: { ...b.content, images: [...existing, ...urls.map((url) => ({ url, alt: "" }))] },
                };
              }
              return { ...b, content: { ...b.content, url: urls[0] ?? "" } };
            })
          );
        }}
      />

      <ConfirmDialog
        open={asking === "save"}
        title={tr("¿Guardar la página?")}
        body={
          draft.status === "published"
            ? tr("Los cambios se verán en el sitio público de inmediato.")
            : tr("La página quedará guardada como borrador, sin publicarse.")
        }
        detail={
          <>
            /{draft.slug} · {tr(draft.blocks.length === 1 ? "{n} bloque" : "{n} bloques", { n: draft.blocks.length })}
          </>
        }
        confirmLabel={tr("Guardar")}
        pending={pending}
        onConfirm={save}
        onCancel={() => setAsking(null)}
      />

      <ConfirmDialog
        open={asking === "delete"}
        title={tr("¿Eliminar \"{title}\"?", { title: page.title })}
        body={tr("La página y su contenido se borran de la base de datos. No se puede deshacer.")}
        tone="danger"
        confirmLabel={tr("Sí, eliminar")}
        pending={pending}
        onConfirm={remove}
        onCancel={() => setAsking(null)}
      />
    </>
  );
}
