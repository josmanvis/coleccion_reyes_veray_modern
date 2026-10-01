"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import { useTr } from "@/components/I18nProvider";

/**
 * The editor for `text` blocks, which store HTML.
 *
 * Content is constrained to the ProseMirror schema below, so pasting from a web
 * page keeps the bold/italic/list structure and drops everything else — scripts,
 * inline styles and stray markup never reach the stored HTML.
 */

const BUTTON =
  "rounded px-2 py-1 text-xs text-[var(--ink-2)] transition hover:bg-[var(--stroke-soft)] disabled:opacity-30";
const ACTIVE = "bg-[var(--brand)] text-white hover:bg-[var(--brand)]";

function ToolbarButton({
  editor,
  label,
  title,
  isActive,
  onClick,
}: {
  editor: Editor;
  label: React.ReactNode;
  title: string;
  isActive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={Boolean(isActive)}
      // Keep focus in the document so the command applies to the selection.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      disabled={!editor.isEditable}
      className={`${BUTTON} ${isActive ? ACTIVE : ""}`}
    >
      {label}
    </button>
  );
}

export default function RichText({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const tr = useTr();
  const editor = useEditor({
    // Required in the App Router: rendering on the server first would hydrate
    // against different markup.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
        code: false,
        link: { openOnClick: false, autolink: true },
      }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "min-h-[180px] w-full px-3 py-2 text-sm leading-relaxed outline-none " +
          "[&_p]:mb-3 [&_h2]:mb-2 [&_h2]:[&_h2]:text-xl [&_h3]:mb-2 [&_h3]:" +
          "[&_h3]:text-lg [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal " +
          "[&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--stroke)] " +
          "[&_blockquote]:pl-3 [&_blockquote]:text-[var(--ink-3)] [&_a]:underline [&_a]:underline-offset-2",
      },
    },
    onUpdate: ({ editor: current }) => {
      const html = current.getHTML();
      // Tiptap represents "empty" as <p></p>; store nothing instead.
      onChange(html === "<p></p>" ? "" : html);
    },
  });

  // Re-sync when the block is replaced from outside (undo, block reorder), but
  // never while typing — setContent would reset the cursor to the start.
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const current = editor.getHTML();
    const incoming = value || "";
    if (incoming !== current && !(incoming === "" && current === "<p></p>")) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) {
    return <div className="min-h-[220px] rounded border border-[var(--stroke)] bg-[var(--surface)]" />;
  }

  function setLink() {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt(tr("Dirección del enlace"), previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <div className="rounded border border-[var(--stroke)] bg-[var(--surface)] focus-within:border-black">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-[var(--stroke-soft)] px-1.5 py-1">
        <ToolbarButton
          editor={editor}
          label={<strong>B</strong>}
          title={tr("Negrita")}
          isActive={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          editor={editor}
          label={<em>I</em>}
          title={tr("Cursiva")}
          isActive={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <span className="mx-1 h-4 w-px bg-[var(--stroke-soft)]" />
        <ToolbarButton
          editor={editor}
          label={tr("H2")}
          title={tr("Encabezado 2")}
          isActive={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <ToolbarButton
          editor={editor}
          label={tr("H3")}
          title={tr("Encabezado 3")}
          isActive={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        />
        <span className="mx-1 h-4 w-px bg-[var(--stroke-soft)]" />
        <ToolbarButton
          editor={editor}
          label={tr("• Lista")}
          title={tr("Lista con viñetas")}
          isActive={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          editor={editor}
          label={tr("1. Lista")}
          title={tr("Lista numerada")}
          isActive={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarButton
          editor={editor}
          label="❝"
          title={tr("Cita")}
          isActive={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <span className="mx-1 h-4 w-px bg-[var(--stroke-soft)]" />
        <ToolbarButton
          editor={editor}
          label={tr("Enlace")}
          title={tr("Añadir o editar enlace")}
          isActive={editor.isActive("link")}
          onClick={setLink}
        />
        <ToolbarButton
          editor={editor}
          label={tr("Limpiar")}
          title={tr("Quitar formato")}
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        />
        <div className="ml-auto flex items-center gap-0.5">
          <ToolbarButton
            editor={editor}
            label="↶"
            title={tr("Deshacer")}
            onClick={() => editor.chain().focus().undo().run()}
          />
          <ToolbarButton
            editor={editor}
            label="↷"
            title={tr("Rehacer")}
            onClick={() => editor.chain().focus().redo().run()}
          />
        </div>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}
