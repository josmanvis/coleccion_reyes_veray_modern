import {isSameOrigin} from "@/lib/site-config";
import { NextResponse } from "next/server";
import { getArtwork } from "@/lib/inventory/db";
import { buildCertificatePdf } from "@/lib/inventory/certificate-pdf";
import { readSetting } from "@/lib/inventory/settings";
import {
  getCertificateByCode,
  issueCertificate,
  noteFormat,
  setCertificateFile,
} from "@/lib/inventory/certificate-log";
import { writeCertificateFile } from "@/lib/inventory/certificate-files";
import {
  CERTIFICATE_TYPES,
  certificateFilename,
  type CertificateInput,
  type CertificateType,
} from "@/lib/inventory/certificates";

import { record } from "@/lib/inventory/audit";
import { currentActor } from "@/lib/inventory/actor";

export const dynamic = "force-dynamic";

function isType(value: unknown): value is CertificateType {
  return typeof value === "string" && (CERTIFICATE_TYPES as readonly string[]).includes(value);
}

export async function POST(request: Request) {
  if(!isSameOrigin(request))return NextResponse.json({error:"Invalid request origin"},{status:403});
  const body = await request.json().catch(() => null);
  if (!body || !isType(body.type)) {
    return NextResponse.json({ error: "Tipo de certificado inválido" }, { status: 400 });
  }
  if (!String(body.party ?? "").trim()) {
    return NextResponse.json({ error: "Falta indicar la persona o entidad" }, { status: 400 });
  }

  const artwork = getArtwork(String(body.ref ?? ""));
  if (!artwork) return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });

  const input: CertificateInput = {
    type: body.type,
    artist: String(body.artist ?? "").trim(),
    registro: String(artwork.registro ?? "").trim(),
    title: String(body.title ?? "").trim(),
    medium: String(body.medium ?? "").trim(),
    dimensions: String(body.dimensions ?? "").trim(),
    year: String(body.year ?? "").trim(),
    edition: String(body.edition ?? "").trim(),
    party: String(body.party).trim(),
    date: String(body.date ?? "").trim(),
    exhibitions: String(body.exhibitions ?? ""),
    publications: String(body.publications ?? ""),
    imageUrl: artwork.image_full ? String(artwork.image_full) : null,
    signatory: readSetting("certificate.signatory"),
    collectionName: readSetting("certificate.collection"),
  };

  // One certificate, possibly downloaded in both formats: the client sends back
  // the code it was given so the pair share an id instead of minting two.
  const existing = typeof body.code === "string" ? getCertificateByCode(body.code) : null;
  if (existing) {
    noteFormat(existing.code, "pdf");
    input.code = existing.code;
  } else {
    input.code = issueCertificate({
      ref: String(artwork.ref),
      registro: input.registro,
      type: input.type,
      party: input.party,
      issuedOn: input.date,
      format: "pdf",
    }).code;
  }

  record({
    actor: await currentActor(),
    action: existing ? "reimprimir certificado" : "emitir certificado",
    entity: "certificado",
    entityId: input.code,
    summary: `${input.code} · ${body.type} · ${input.registro} para ${input.party}`,
  });

  try {
    const file = await buildCertificatePdf(input);
    const filename = certificateFilename(input);

    // Keep what was handed over, so the certificates page can show it again.
    const issued = getCertificateByCode(input.code!);
    if (issued) {
      const stored = await writeCertificateFile(issued.id, "pdf", file);
      setCertificateFile(issued.id, { ...stored, ext: "pdf" });
    }
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "X-Certificate-Code": input.code ?? "",
        "Access-Control-Expose-Headers": "X-Certificate-Code",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
