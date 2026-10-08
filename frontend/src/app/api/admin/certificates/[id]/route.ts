import {isSameOrigin} from "@/lib/site-config";
import { NextResponse } from "next/server";
import {
  deleteCertificate,
  getCertificate,
  resolveCertificateRef,
  updateCertificate,
  type CertificatePatch,
} from "@/lib/inventory/certificate-log";
import { certificateDisplayName, isCertificateType } from "@/lib/inventory/certificates";
import { record } from "@/lib/inventory/audit";
import { currentActor } from "@/lib/inventory/actor";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

function text(value: unknown): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

/** Corrects the type, CRV number, party, date or notes of a certificate. */
export async function PATCH(request: Request, { params }: Context) {
  if(!isSameOrigin(request))return NextResponse.json({error:"Invalid request origin"},{status:403});
  const { id } = await params;
  const before = getCertificate(Number(id));
  if (!before) return NextResponse.json({ error: "Certificado no encontrado" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const patch: CertificatePatch = {};

  if ("type" in body) {
    if (!isCertificateType(body.type)) {
      return NextResponse.json({ error: "Tipo de certificado inválido" }, { status: 400 });
    }
    patch.type = body.type;
  }
  if ("registro" in body) {
    patch.registro = text(body.registro);
    // A new number relinks the certificate to that work's ficha.
    patch.ref = resolveCertificateRef(patch.registro);
  }
  if ("party" in body) patch.party = text(body.party);
  if ("issued_on" in body) patch.issued_on = text(body.issued_on);
  if ("notes" in body) patch.notes = text(body.notes);

  const updated = updateCertificate(before.id, patch)!;

  const oldName = certificateDisplayName(before.type, before.registro);
  const newName = certificateDisplayName(updated.type, updated.registro);
  record({
    actor: await currentActor(),
    action: "editar certificado",
    entity: "certificado",
    entityId: updated.code,
    summary: oldName === newName ? `${newName} actualizado` : `${oldName} → ${newName}`,
  });

  return NextResponse.json(updated);
}

/** Moves the certificate and its file to the trash, where it can be restored. */
export async function DELETE(_request: Request, { params }: Context) {
  if(!isSameOrigin(_request))return NextResponse.json({error:"Invalid request origin"},{status:403});
  const { id } = await params;
  const certificate = getCertificate(Number(id));
  if (!certificate) return NextResponse.json({ error: "Certificado no encontrado" }, { status: 404 });

  const actor = await currentActor();
  const trashId = deleteCertificate(certificate.id, actor);

  record({
    actor,
    action: "eliminar certificado",
    entity: "certificado",
    entityId: certificate.code,
    summary: `${certificateDisplayName(certificate.type, certificate.registro)} eliminado`,
  });

  return NextResponse.json({ ok: true, trashId });
}
