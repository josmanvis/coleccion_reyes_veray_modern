"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { Check, Copy, KeyRound, Network, Printer, Save, Share } from "lucide-react";
import { BTN, BTN_PRIMARY, BTN_SUBTLE, CARD, FIELD, LABEL, MUTED } from "./ui";
import { useToast } from "./ToastProvider";
import { useTr } from "@/components/I18nProvider";
import { canShare, shareLabel, shareLink } from "./share";

const noSubscribe = () => () => {};

type Settings = Record<string, string>;


export default function SettingsForm({
  initial,
  canEdit,
  mustChange,
  dataDirectory,
  networkAddresses,
}: {
  initial: Settings;
  canEdit: boolean;
  mustChange: boolean;
  dataDirectory: string;
  /** What another machine would type to get here. */
  networkAddresses: string[];
}) {
  const tr = useTr();
  const router = useRouter();
  const { notify } = useToast();
  const [values, setValues] = useState<Settings>(initial);
  const [pending, setPending] = useState(false);
  const [printers, setPrinters] = useState<string[]>([]);
  const [password, setPassword] = useState({ current: "", next: "", repeat: "" });

  const dirty = Object.keys(initial).some((key) => values[key] !== initial[key]);
  const [copied, setCopied] = useState<string | null>(null);
  // Known only in the browser; the server render leaves the button out.
  const sharable = useSyncExternalStore(noSubscribe, canShare, () => false);

  async function share(address: string) {
    try {
      if (!(await shareLink(address, "CRVMGMT"))) notify(tr("Este navegador no puede compartir"), "error");
    } catch {
      notify(tr("No se pudo compartir"), "error");
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      notify(tr("El navegador no permitió copiar"), "error");
    }
  }

  function set(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setPending(true);
    const response = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      notify(tr("Ajustes guardados"));
      router.refresh();
    } else {
      notify(tr(data.error || "No se pudieron guardar"), "error");
    }
    setPending(false);
  }

  /** Printer names come from the desktop shell; a browser cannot enumerate them. */
  async function loadPrinters() {
    const shell = (window as unknown as {
      crvmgmt?: { listPrinters: () => Promise<Array<{ name: string; displayName?: string }>> };
    }).crvmgmt;
    if (!shell) {
      notify(tr("Solo disponible en CRVMGMT"), "error");
      return;
    }
    const found = await shell.listPrinters();
    setPrinters(found.map((p) => p.displayName || p.name));
    notify(tr("{n} impresora(s) encontradas", { n: found.length }));
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    if (password.next !== password.repeat) {
      notify(tr("Las contraseñas nuevas no coinciden"), "error");
      return;
    }
    setPending(true);
    const response = await fetch("/api/auth", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current: password.current, next: password.next }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      notify(tr("Contraseña actualizada"));
      setPassword({ current: "", next: "", repeat: "" });
      router.refresh();
    } else {
      notify(tr(data.error || "No se pudo cambiar"), "error");
    }
    setPending(false);
  }

  return (
    <div className="space-y-4">
      <section className={`${CARD} p-4`}>
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <KeyRound size={16} strokeWidth={1.75} aria-hidden />
          
          {tr("Mi contraseña")}
        </h2>
        {mustChange && (
          <p className="mt-2 rounded-[var(--radius)] border border-[color:var(--warning)]/30 bg-[var(--warning-soft)] px-3 py-2 text-sm text-[var(--warning)]">
            
            {tr("Tu contraseña fue restablecida por un administrador. Cámbiala ahora.")}
          </p>
        )}
        <form onSubmit={changePassword} className="mt-3 grid gap-3 sm:grid-cols-3">
          <label>
            <span className={LABEL}>{tr("Contraseña actual")}</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password.current}
              onChange={(e) => setPassword({ ...password, current: e.target.value })}
              className={FIELD}
            />
          </label>
          <label>
            <span className={LABEL}>{tr("Nueva (mínimo 8)")}</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password.next}
              onChange={(e) => setPassword({ ...password, next: e.target.value })}
              className={FIELD}
            />
          </label>
          <label>
            <span className={LABEL}>{tr("Repetir nueva")}</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password.repeat}
              onChange={(e) => setPassword({ ...password, repeat: e.target.value })}
              className={FIELD}
            />
          </label>
          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={pending || !password.current || password.next.length < 8}
              className={BTN_PRIMARY}
            >
              
              {tr("Cambiar contraseña")}
            </button>
          </div>
        </form>
      </section>

      <section className={`${CARD} p-4`}>
        <h2 className="text-sm font-semibold">{tr("Certificados")}</h2>
        <p className={`mt-1 text-sm ${MUTED}`}>
          
          {tr("Aparecen bajo la línea de firma en cada certificado generado.")}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label>
            <span className={LABEL}>{tr("Firma")}</span>
            <input
              value={values["certificate.signatory"] ?? ""}
              onChange={(e) => set("certificate.signatory", e.target.value)}
              disabled={!canEdit}
              className={FIELD}
            />
          </label>
          <label>
            <span className={LABEL}>{tr("Colección")}</span>
            <input
              value={values["certificate.collection"] ?? ""}
              onChange={(e) => set("certificate.collection", e.target.value)}
              disabled={!canEdit}
              className={FIELD}
            />
          </label>
        </div>
      </section>

      <section className={`${CARD} p-4`}>
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Network size={16} strokeWidth={1.75} aria-hidden />
          
          {tr("Red")}
        </h2>
        <p className={`mt-1 text-sm ${MUTED}`}>
          
          {tr("Cualquier computadora de la red puede abrir CRVMGMT en su navegador con su propio usuario y contraseña. Las funciones del escritorio —sincronizar con FileMaker Pro, imprimir directo, elegir archivos— se quedan en esta computadora.")}
        </p>

        {networkAddresses.length > 0 ? (
          <div className="mt-3">
            <span className={LABEL}>{tr("Dirección para otras computadoras")}</span>
            <ul className="space-y-1">
              {networkAddresses.map((address) => (
                <li key={address} className="flex items-center gap-2">
                  <code className="rounded-[var(--radius)] border border-[var(--stroke-soft)] bg-[var(--surface-alt)] px-2 py-1 font-mono text-xs text-[var(--ink-1)]">
                    {address}
                  </code>
                  <button
                    type="button"
                    onClick={() => copy(address)}
                    className={BTN_SUBTLE}
                    aria-label={tr("Copiar {address}", { address })}
                  >
                    {copied === address ? (
                      <Check size={14} strokeWidth={2} aria-hidden />
                    ) : (
                      <Copy size={14} strokeWidth={1.75} aria-hidden />
                    )}
                    {copied === address ? tr("Copiada") : tr("Copiar")}
                  </button>
                  {sharable && (
                    <button
                      type="button"
                      onClick={() => share(address)}
                      className={BTN_SUBTLE}
                      title={tr("Enviar a un iPhone, iPad u otra Mac por AirDrop, Mensajes o Correo")}
                    >
                      <Share size={14} strokeWidth={1.75} aria-hidden />
                      {shareLabel(tr)}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className={`mt-3 text-sm ${MUTED}`}>
            
            {tr("Esta computadora no tiene una dirección de red ahora mismo.")}
          </p>
        )}
      </section>

      <section className={`${CARD} p-4`}>
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Printer size={16} strokeWidth={1.75} aria-hidden />
          
          {tr("Impresión")}
        </h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="min-w-[260px] flex-1">
            <span className={LABEL}>{tr("Impresora para certificados")}</span>
            <input
              value={values["print.defaultPrinter"] ?? ""}
              onChange={(e) => set("print.defaultPrinter", e.target.value)}
              placeholder={tr("Vacía = impresora del sistema")}
              disabled={!canEdit}
              className={FIELD}
              list="crvmgmt-printers"
            />
            <datalist id="crvmgmt-printers">
              {printers.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
          <button type="button" onClick={loadPrinters} className={BTN}>
            
            {tr("Buscar impresoras")}
          </button>
        </div>
      </section>

      <section className={`${CARD} p-4`}>
        <h2 className="text-sm font-semibold">{tr("FileMaker Pro")}</h2>
        <p className={`mt-1 text-sm ${MUTED}`}>
          
          {tr("Se recuerdan aquí para que la pantalla de sincronización no vuelva a preguntarlos.")}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className={LABEL}>{tr("Archivo .fmp12")}</span>
            <input
              value={values["filemaker.filePath"] ?? ""}
              onChange={(e) => set("filemaker.filePath", e.target.value)}
              disabled={!canEdit}
              className={FIELD}
            />
          </label>
          <label>
            <span className={LABEL}>{tr("Base de datos abierta")}</span>
            <input
              value={values["filemaker.database"] ?? ""}
              onChange={(e) => set("filemaker.database", e.target.value)}
              disabled={!canEdit}
              className={FIELD}
            />
          </label>
          <label>
            <span className={LABEL}>{tr("Tabla ODBC")}</span>
            <input
              value={values["filemaker.odbcTable"] ?? ""}
              onChange={(e) => set("filemaker.odbcTable", e.target.value)}
              disabled={!canEdit}
              className={FIELD}
            />
          </label>
          <label className="sm:col-span-2">
            <span className={LABEL}>{tr("Cadena de conexión ODBC")}</span>
            <input
              value={values["filemaker.odbcConnection"] ?? ""}
              onChange={(e) => set("filemaker.odbcConnection", e.target.value)}
              placeholder={tr("DSN=CRV;UID=admin;PWD=…")}
              disabled={!canEdit}
              className={FIELD}
            />
          </label>
        </div>
      </section>

      <section className={`${CARD} p-4`}>
        <h2 className="text-sm font-semibold">{tr("Datos")}</h2>
        <p className={`mt-1 text-sm ${MUTED}`}>
          {tr("La base de datos vive en")} <span className="font-mono text-xs">{dataDirectory}</span>
        </p>
      </section>

      {canEdit && (
        <div className="sticky bottom-0 flex items-center gap-3 border-t border-[var(--stroke-soft)] bg-[var(--surface)] px-4 py-3">
          <span className={`text-sm ${MUTED}`}>{dirty ? tr("Cambios sin guardar") : tr("Sin cambios")}</span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => setValues(initial)}
              disabled={!dirty || pending}
              className={BTN}
            >
              
              {tr("Descartar")}
            </button>
            <button type="button" onClick={save} disabled={!dirty || pending} className={BTN_PRIMARY}>
              <Save size={15} strokeWidth={1.75} aria-hidden />
              {pending ? tr("Guardando…") : tr("Guardar ajustes")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
