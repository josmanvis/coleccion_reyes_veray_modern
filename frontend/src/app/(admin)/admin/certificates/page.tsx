import { getDb, type ArtworkRow } from "@/lib/inventory/db";
import { listCertificates } from "@/lib/inventory/certificate-log";
import { artistName, titleCase } from "@/lib/inventory/fields";
import CertificatesManager, { type CertificateRow } from "@/components/inventory/CertificatesManager";
import { PAGE } from "@/components/inventory/ui";

export const dynamic = "force-dynamic";

export const metadata = { title: "Certificados · Inventario" };

export default async function CertificatesPage() {
  const certificates = listCertificates();

  const refs = [...new Set(certificates.map((c) => c.ref).filter(Boolean))];
  const artworks = new Map<string, ArtworkRow>();
  if (refs.length) {
    const rows = getDb()
      .prepare(`SELECT * FROM artworks WHERE ref IN (${refs.map(() => "?").join(",")})`)
      .all(...refs) as ArtworkRow[];
    for (const row of rows) artworks.set(String(row.ref), row);
  }

  const rows: CertificateRow[] = certificates.map((certificate) => {
    const artwork = artworks.get(certificate.ref);
    return {
      ...certificate,
      artwork: artwork
        ? {
            ref: String(artwork.ref),
            artist: artistName(artwork),
            title: artwork.title ? titleCase(String(artwork.title)) : "",
          }
        : null,
    };
  });

  return (
    <main className={PAGE}>
      <div className="pb-5">
        <h1 className="text-3xl leading-none">Certificados</h1>
        <p className="mt-1.5 max-w-[75ch] text-sm text-[var(--ink-3)]">
          Todos los certificados de obsequio, adquisición y donación: los de Word emitidos antes de la
          app y los PDF que genera cada ficha. Cada uno se nombra «Certificado de &lt;tipo&gt; CRV
          &lt;número&gt;».
        </p>
      </div>
      <CertificatesManager rows={rows} />
    </main>
  );
}
