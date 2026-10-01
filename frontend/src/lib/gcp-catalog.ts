import { Pool } from "pg";
import { createHash, randomUUID } from "node:crypto";

const state = globalThis as unknown as { orcPool?: Pool };
function pool(): Pool {
  if (!process.env.ORC_DATABASE_URL) throw new Error("GCP catalog database is not configured");
  return state.orcPool ??= new Pool({connectionString: process.env.ORC_DATABASE_URL, max: 2, connectionTimeoutMillis: 8000, idleTimeoutMillis: 30000, statement_timeout: 8000, query_timeout: 8000, allowExitOnIdle: true});
}
const camelRow = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).map(([key,value]) => [key.replace(/_([a-z])/g, (_,letter) => letter.toUpperCase()), value]));

/** Views expose only this client's published records, enforced by PostgreSQL. */
export async function readGcpCatalog(path: string): Promise<unknown> {
  const url = new URL(path, "https://orc.axxes.app");
  const db = pool();
  if (url.pathname === "/inventory") {
    const slug = url.searchParams.get("slug");
    const featured = url.searchParams.get("featured") === "true";
    const where = `${slug ? " WHERE slug=$1" : featured ? " WHERE is_featured=true" : ""}`;
    const params = slug ? [slug] : [];
    if (url.searchParams.get("fields") === "slugs") return (await db.query(`SELECT slug FROM orc_public.products${where} ORDER BY created_at DESC`, params)).rows.map(row => row.slug).filter(Boolean);
    if (url.searchParams.get("fields") === "artistIndex") return (await db.query(`SELECT slug,name AS title,images->0->>'url' AS image FROM orc_public.products${where} ORDER BY created_at DESC`, params)).rows;
    const limit = Math.max(1, Math.min(5000, Number(url.searchParams.get("limit")) || 5000));
    return (await db.query(`SELECT * FROM orc_public.products${where} ORDER BY created_at DESC LIMIT ${limit}`, params)).rows.map(camelRow);
  }
  if (url.pathname === "/artists") {
    const slug = url.searchParams.get("slug");
    return (await db.query(`SELECT id,slug,name,bio,lifespan,artwork_count FROM orc_public.artists${slug ? " WHERE slug=$1" : ""} ORDER BY sort_name,name`, slug ? [slug] : [])).rows.map(camelRow);
  }
  if (url.pathname.startsWith("/pages/")) {
    const slug = decodeURIComponent(url.pathname.slice("/pages/".length));
    const page = (await db.query("SELECT * FROM orc_public.pages WHERE slug=$1", [slug])).rows[0];
    if (!page) return null;
    const blocks = (await db.query("SELECT type,content,settings FROM orc_public.page_blocks WHERE page_id=$1 ORDER BY sort_order", [page.id])).rows;
    return {...camelRow(page), blocks};
  }
  if (url.pathname === "/settings") {
    const tenant = (await db.query("SELECT name,slug,email FROM orc_public.tenants")).rows[0];
    const settings = (await db.query("SELECT * FROM orc_public.website_settings")).rows[0];
    return {tenant, settings: settings ? camelRow(settings) : null};
  }
  return null;
}

export type InquiryPayload = {name?: string; email: string; phone?: string; message?: string; artworkTitle?: string; artworkSlug?: string; artworkImage?: string; source?: string; submissionId?: string};
export async function saveGcpInquiry(payload: InquiryPayload): Promise<boolean> {
  const email = payload.email.trim().toLowerCase();
  if (!email.includes("@") || email.length > 320) return false;
  const db = await pool().connect();
  let failed = false;
  try {
    await db.query("BEGIN");
    const submissionId = payload.submissionId || randomUUID();
    const hash = createHash("sha256").update(JSON.stringify({email,name:payload.name || "",phone:payload.phone || "",message:payload.message || "",artworkTitle:payload.artworkTitle || "",artworkSlug:payload.artworkSlug || "",source:payload.source || "coleccion-website"})).digest("hex");
    const reserved = await db.query("INSERT INTO orc_public.inquiry_submissions (id,payload_hash) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING id", [submissionId,hash]);
    if (!reserved.rowCount) {
      const existing = await db.query("SELECT payload_hash FROM orc_public.inquiry_submissions WHERE id=$1", [submissionId]);
      await db.query("COMMIT");
      return existing.rows[0]?.payload_hash === hash;
    }
    // Serialize repeat submissions from the same contact without a new shared-table index.
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`orc-inquiry:${email}`]);
    const tenant = (await db.query("SELECT id FROM orc_public.tenants")).rows[0];
    if (!tenant) throw new Error("Collection tenant is missing");
    const name = (payload.name ?? "").trim().split(/\s+/).filter(Boolean);
    const note = [payload.artworkTitle ? `Artwork: ${payload.artworkTitle}` : null, payload.artworkSlug ? `Slug: ${payload.artworkSlug}` : null, payload.message ? `Message: ${payload.message}` : null, `Source: ${payload.source || "coleccion-website"}`, `Received: ${new Date().toISOString()}`].filter(Boolean).join("\n");
    const existing = (await db.query("SELECT id,notes,phone FROM orc_public.contacts WHERE lower(email)=$1 ORDER BY created_at LIMIT 1 FOR UPDATE", [email])).rows[0];
    if (existing) await db.query("UPDATE orc_public.contacts SET lead_status='new', notes=$2, phone=$3, updated_at=now() WHERE id=$1", [existing.id, existing.notes ? `${existing.notes}\n\n---\n${note}` : note, payload.phone || existing.phone]);
    else await db.query("INSERT INTO orc_public.contacts (tenant_id,email,first_name,last_name,phone,type,lead_status,lead_source,notes,custom_fields) VALUES ($1,$2,$3,$4,$5,'lead','new',$6,$7,$8)", [tenant.id,email,name[0] || null,name.slice(1).join(" ") || null,payload.phone || null,payload.source || "coleccion-website",note,JSON.stringify({artworkTitle:payload.artworkTitle || null,artworkSlug:payload.artworkSlug || null,artworkImage:payload.artworkImage || null})]);
    await db.query("COMMIT");
    return true;
  } catch (error) {failed = true; throw error;}
  // Destroying a failed connection rolls back server-side without another network wait.
  finally {db.release(failed);}
}
