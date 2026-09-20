"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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

const FIELD =
  "w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900";
const BTN =
  "rounded border px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40";

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-xs font-medium text-neutral-600">{children}</span>;
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
  const c = block.content;
  const set = (patch: Record<string, unknown>) => onChange({ ...c, ...patch });

  switch (block.type) {
    case "heading":
      return (
        <div className="grid gap-3 sm:grid-cols-[110px_1fr]">
          <label>
            <Label>Nivel</Label>
            <select
              value={String(c.level ?? "h2")}
              onChange={(e) => set({ level: e.target.value })}
              className={FIELD}
            >
              <option value="h1">H1</option>
              <option value="h2">H2</option>
              <option value="h3">H3</option>
            </select>
          </label>
          <label>
            <Label>Texto</Label>
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
        <label className="block">
          <Label>Texto (admite HTML sencillo: &lt;p&gt;, &lt;em&gt;, &lt;a&gt;)</Label>
          <textarea
            value={String(c.html ?? "")}
            onChange={(e) => set({ html: e.target.value })}
            rows={7}
            className={`${FIELD} font-mono text-xs leading-relaxed`}
          />
        </label>
      );

    case "image":
      return (
        <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
          <div>
            <Label>Imagen</Label>
            <div className="relative aspect-square overflow-hidden rounded border border-neutral-300 bg-neutral-100">
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
                <span className="flex size-full items-center justify-center text-xs text-neutral-500">
                  Sin imagen
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onPickImage}
              className={`${BTN} mt-2 w-full border-neutral-300 text-neutral-800 hover:border-neutral-500 focus-visible:outline-neutral-900`}
            >
              {c.url ? "Cambiar" : "Elegir imagen"}
            </button>
          </div>
          <div className="space-y-3">
            <label className="block">
              <Label>Texto alternativo</Label>
              <input
                type="text"
                value={String(c.alt ?? "")}
                onChange={(e) => set({ alt: e.target.value })}
                className={FIELD}
              />
            </label>
            <label className="block">
              <Label>Pie de foto</Label>
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
          <Label>{images.length} imagen{images.length === 1 ? "" : "es"}</Label>
          {images.length > 0 && (
            <ul className="mb-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {images.map((img, i) => (
                <li key={i} className="group relative">
                  <span className="relative block aspect-square overflow-hidden rounded border border-neutral-300 bg-neutral-100">
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
                    aria-label="Quitar imagen"
                    onClick={() => set({ images: images.filter((_, j) => j !== i) })}
                    className="absolute -right-1 -top-1 rounded-full border border-neutral-300 bg-white px-1.5 text-xs text-neutral-700 shadow-sm hover:border-red-400 hover:text-red-700"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={onPickGallery}
            className={`${BTN} border-neutral-300 text-neutral-800 hover:border-neutral-500 focus-visible:outline-neutral-900`}
          >
            Añadir imágenes
          </button>
        </div>
      );
    }

    case "cta":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <Label>Texto del enlace</Label>
            <input
              type="text"
              value={String(c.text ?? "")}
              onChange={(e) => set({ text: e.target.value })}
              className={FIELD}
            />
          </label>
          <label>
            <Label>Destino</Label>
            <input
              type="text"
              value={String(c.link ?? "")}
              onChange={(e) => set({ link: e.target.value })}
              placeholder="/gallery"
              className={FIELD}
            />
          </label>
        </div>
      );

    case "spacer":
      return (
        <label className="block max-w-[200px]">
          <Label>Altura (px)</Label>
          <input
            type="number"
            value={Number(c.height ?? 40)}
            onChange={(e) => set({ height: Number(e.target.value) || 0 })}
            className={FIELD}
          />
        </label>
      );

    default:
      return <p className="text-sm text-neutral-500">Sin opciones.</p>;
  }
}

export default function PageEditor({ page }: { page: PageRow }) {
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
      notify(`Página "${body.title}" guardada`);
      if (body.slug !== page.slug) router.replace(`/admin/content/${body.slug}`);
      router.refresh();
    } else {
      notify(body.error || "No se pudo guardar", "error");
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
      notify(`Página "${page.title}" eliminada`);
      router.push("/admin/content");
      router.refresh();
    } else {
      const body = await response.json().catch(() => ({}));
      notify(body.error || "No se pudo eliminar", "error");
      setPending(false);
      setAsking(null);
    }
  }

  return (
    <>
      <div className="sticky top-[var(--admin-header-h)] z-30 -mx-5 mb-6 flex flex-wrap items-center gap-3 border-b border-neutral-200 bg-[#fdfcfc]/95 px-5 py-3 backdrop-blur">
        <span className="text-sm text-neutral-600">
          {dirty ? "Cambios sin guardar" : "Sin cambios"}
        </span>
        <span
          className={`rounded border px-2 py-0.5 text-xs font-medium ${
            draft.status === "published"
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-neutral-300 bg-neutral-100 text-neutral-700"
          }`}
        >
          {draft.status === "published" ? "Publicada" : "Borrador"}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {draft.status === "published" && (
            <Link
              href={`/${draft.slug}`}
              className={`${BTN} border-neutral-300 text-neutral-700 hover:border-neutral-500 focus-visible:outline-neutral-900`}
            >
              Ver en el sitio
            </Link>
          )}
          <button
            type="button"
            onClick={() =>
              setField("status", draft.status === "published" ? "draft" : "published")
            }
            className={`${BTN} border-neutral-300 text-neutral-800 hover:border-neutral-500 focus-visible:outline-neutral-900`}
          >
            {draft.status === "published" ? "Pasar a borrador" : "Publicar"}
          </button>
          <button
            type="button"
            disabled={!dirty || pending}
            onClick={() => setAsking("save")}
            className={`${BTN} border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-700 focus-visible:outline-neutral-900`}
          >
            Guardar
          </button>
        </div>
      </div>

      <section className="mb-8 grid gap-4 rounded border border-neutral-200 bg-white p-4 sm:grid-cols-2">
        <label>
          <Label>Título</Label>
          <input
            type="text"
            value={draft.title}
            onChange={(e) => setField("title", e.target.value)}
            className={FIELD}
          />
        </label>
        <label>
          <Label>Slug (dirección pública)</Label>
          <input
            type="text"
            value={draft.slug}
            onChange={(e) => setField("slug", e.target.value)}
            className={`${FIELD} font-mono`}
          />
        </label>
        <label className="sm:col-span-2">
          <Label>Descripción corta</Label>
          <input
            type="text"
            value={draft.description ?? ""}
            onChange={(e) => setField("description", e.target.value)}
            className={FIELD}
          />
        </label>
        <label>
          <Label>Meta título (SEO)</Label>
          <input
            type="text"
            value={draft.meta_title ?? ""}
            onChange={(e) => setField("meta_title", e.target.value)}
            className={FIELD}
          />
        </label>
        <label>
          <Label>Meta descripción (SEO)</Label>
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
          <li key={index} className="rounded border border-neutral-200 bg-white">
            <header className="flex items-center gap-2 border-b border-neutral-200 px-4 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
                {BLOCK_LABELS[block.type] ?? block.type}
              </span>
              <span className="text-xs text-neutral-400">#{index + 1}</span>
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Subir bloque"
                  disabled={index === 0}
                  onClick={() => moveBlock(index, -1)}
                  className="rounded px-2 py-1 text-sm text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="Bajar bloque"
                  disabled={index === draft.blocks.length - 1}
                  onClick={() => moveBlock(index, 1)}
                  className="rounded px-2 py-1 text-sm text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => setBlocks(draft.blocks.filter((_, i) => i !== index))}
                  className="rounded px-2 py-1 text-sm text-red-700 transition hover:bg-red-50"
                >
                  Quitar
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
        <p className="rounded border border-dashed border-neutral-300 px-4 py-10 text-center text-sm text-neutral-600">
          Esta página todavía no tiene contenido. Añade un bloque para empezar.
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-neutral-200 pt-6">
        <span className="text-xs font-medium text-neutral-600">Añadir bloque:</span>
        {(Object.keys(BLOCK_LABELS) as BlockType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => addBlock(type)}
            className={`${BTN} border-neutral-300 text-neutral-800 hover:border-neutral-500 focus-visible:outline-neutral-900`}
          >
            + {BLOCK_LABELS[type]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAsking("delete")}
          className={`${BTN} ml-auto border-red-300 text-red-800 hover:border-red-500 hover:bg-red-50 focus-visible:outline-red-700`}
        >
          Eliminar página
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
        title="¿Guardar la página?"
        body={
          draft.status === "published"
            ? "Los cambios se verán en el sitio público de inmediato."
            : "La página quedará guardada como borrador, sin publicarse."
        }
        detail={
          <>
            /{draft.slug} · {draft.blocks.length} bloque{draft.blocks.length === 1 ? "" : "s"}
          </>
        }
        confirmLabel="Guardar"
        pending={pending}
        onConfirm={save}
        onCancel={() => setAsking(null)}
      />

      <ConfirmDialog
        open={asking === "delete"}
        title={`¿Eliminar "${page.title}"?`}
        body="La página y su contenido se borran de la base de datos. No se puede deshacer."
        tone="danger"
        confirmLabel="Sí, eliminar"
        pending={pending}
        onConfirm={remove}
        onCancel={() => setAsking(null)}
      />
    </>
  );
}
