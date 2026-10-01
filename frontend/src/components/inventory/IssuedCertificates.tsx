"use client";

import { useState } from "react";
import { Copy, Download, Eye } from "lucide-react";
import type { CertificateRecord } from "@/lib/inventory/certificate-log";
import { certificateDisplayName, spanishDate } from "@/lib/inventory/certificates";
import { BTN_SUBTLE, CARD, MUTED } from "./ui";
import CertificateViewer from "./CertificateViewer";
import { copyText, download, useContextMenu } from "./ContextMenu";
import { useTr } from "@/components/I18nProvider";

/** The certificates issued for one work, each readable in place. */
export default function IssuedCertificates({ certificates }: { certificates: CertificateRecord[] }) {
  const tr = useTr();
  const menu = useContextMenu();
  const [index, setIndex] = useState<number | null>(null);
  const viewed = index === null ? null : certificates[index];

  return (
    <>
      <div className={`${CARD} mt-3 divide-y divide-[var(--stroke-soft)]`}>
        {certificates.map((certificate, i) => {
          const name = certificateDisplayName(certificate.type, certificate.registro);
          const fileUrl = `/api/admin/certificates/${certificate.id}/file`;
          return (
            <div
              key={certificate.id}
              className="flex cursor-default flex-wrap items-center gap-3 px-4 py-2.5 text-sm hover:bg-[var(--hover)]"
              onDoubleClick={() => setIndex(i)}
              onContextMenu={menu(() => [
                { label: tr("Ver certificado"), icon: Eye, run: () => setIndex(i) },
                certificate.file_name && {
                  label: tr("Descargar"),
                  icon: Download,
                  run: () => download(fileUrl),
                },
                "separator",
                { label: tr("Copiar nombre"), icon: Copy, run: () => copyText(name) },
              ])}
            >
              <button type="button" onClick={() => setIndex(i)} className="font-semibold hover:underline">
                {name}
              </button>
              {certificate.party && <span className={MUTED}>{certificate.party}</span>}
              <span className={`ml-auto text-xs ${MUTED}`}>
                {certificate.issued_on ? spanishDate(certificate.issued_on) : certificate.created_at.slice(0, 10)}
              </span>
              <button type="button" className={BTN_SUBTLE} onClick={() => setIndex(i)} title={tr("Ver certificado")}>
                <Eye size={14} strokeWidth={1.75} aria-hidden />
                <span className="sr-only">{tr("Ver certificado")}</span>
              </button>
              {certificate.file_name && (
                <a href={fileUrl} className="inline-flex items-center gap-1 text-xs text-[var(--brand)] hover:underline">
                  <Download size={14} strokeWidth={1.75} aria-hidden />
                  {certificate.file_ext?.toUpperCase()}
                </a>
              )}
            </div>
          );
        })}
      </div>

      <CertificateViewer
        certificate={
          viewed && {
            id: viewed.id,
            name: certificateDisplayName(viewed.type, viewed.registro),
            ext: viewed.file_ext,
            hasFile: Boolean(viewed.file_name),
            bodyText: viewed.body_text,
          }
        }
        position={index !== null && certificates.length > 1 ? tr("{n} de {total}", { n: index + 1, total: certificates.length }) : undefined}
        onClose={() => setIndex(null)}
        onPrevious={index !== null && index > 0 ? () => setIndex(index - 1) : undefined}
        onNext={index !== null && index < certificates.length - 1 ? () => setIndex(index + 1) : undefined}
      />
    </>
  );
}
