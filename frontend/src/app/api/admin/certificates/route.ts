import { NextResponse } from "next/server";
import {
  addArchivedCertificate,
  findCertificateByHash,
  listCertificates,
  resolveCertificateRef,
  setCertificateFile,
} from "@/lib/inventory/certificate-log";
import {
  MAX_CERTIFICATE_BYTES,
  docxParagraphs,
  parseCertificate,
  writeCertificateFile,
} from "@/lib/inventory/certificate-files";
import {
  CERTIFICATE_FILE_TYPES,
  certificateDisplayName,
  isCertificateType,
} from "@/lib/inventory/certificates";
import { record } from "@/lib/inventory/audit";
import { currentActor } from "@/lib/inventory/actor";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ certificates: listCertificates() });
}

/**
 * Files a certificate made outside the app. For Word files the type, number,
 * party and date are read from the document; anything the form sends wins.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!(ext in CERTIFICATE_FILE_TYPES)) {
    return NextResponse.json({ error: "Solo se admiten archivos .docx o .pdf" }, { status: 400 });
  }
  if (file.size > MAX_CERTIFICATE_BYTES) {
    return NextResponse.json({ error: "El archivo es demasiado grande" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  const duplicate = findCertificateByHash(sha256);
  if (duplicate) {
    return NextResponse.json(
      {
        error: `Ya está guardado como ${certificateDisplayName(duplicate.type, duplicate.registro)}`,
      },
      { status: 409 }
    );
  }

  const parsed = ext === "pdf" ? null : parseCertificate(docxParagraphs(bytes));
  const field = (name: string) => String(form?.get(name) ?? "").trim() || null;

  const type = field("type") ?? parsed?.type ?? null;
  if (!isCertificateType(type)) {
    return NextResponse.json({ error: "Indica el tipo de certificado" }, { status: 400 });
  }
  const registro = field("registro") ?? parsed?.registro ?? null;

  const certificate = addArchivedCertificate({
    ref: resolveCertificateRef(registro),
    registro,
    type,
    party: field("party") ?? parsed?.party ?? null,
    issuedOn: field("issued_on") ?? parsed?.issuedOn ?? null,
    artist: parsed?.artist,
    title: parsed?.title,
    edition: parsed?.edition,
    bodyText: parsed?.paragraphs.join("\n") ?? null,
    originalName: file.name,
    fileExt: ext,
  });
  const stored = await writeCertificateFile(certificate.id, ext, bytes);
  setCertificateFile(certificate.id, { ...stored, ext });

  record({
    actor: await currentActor(),
    action: "archivar certificado",
    entity: "certificado",
    entityId: certificate.code,
    summary: `${certificateDisplayName(type, registro)} (de ${file.name})`,
  });

  return NextResponse.json(certificate, { status: 201 });
}
