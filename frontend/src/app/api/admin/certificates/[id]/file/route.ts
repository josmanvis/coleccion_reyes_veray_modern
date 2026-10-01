import { NextResponse } from "next/server";
import { getCertificate } from "@/lib/inventory/certificate-log";
import { readCertificateFile } from "@/lib/inventory/certificate-files";
import { CERTIFICATE_FILE_TYPES, certificateDisplayName } from "@/lib/inventory/certificates";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/**
 * Serves the stored file under its certificate name. `?inline=1` lets a PDF
 * open in the browser; Word files always download.
 */
export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  const certificate = getCertificate(Number(id));
  if (!certificate?.file_name || !certificate.file_ext) {
    return NextResponse.json({ error: "Este certificado no tiene archivo guardado" }, { status: 404 });
  }

  const bytes = await readCertificateFile(certificate.file_name).catch(() => null);
  if (!bytes) return NextResponse.json({ error: "No se encontró el archivo" }, { status: 404 });

  const filename = certificateDisplayName(certificate.type, certificate.registro, certificate.file_ext);
  const inline = new URL(request.url).searchParams.get("inline") === "1" && certificate.file_ext === "pdf";

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": CERTIFICATE_FILE_TYPES[certificate.file_ext] ?? "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
