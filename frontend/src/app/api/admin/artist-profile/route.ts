import { NextResponse } from "next/server";
import { getArtistBySlug } from "@/lib/inventory/public";
import { getProfile, saveArticle, saveProfile } from "@/lib/inventory/artist-profile";
import { fetchArticle, searchArtist, type WikiLang } from "@/lib/inventory/wikipedia";
import { record } from "@/lib/inventory/audit";
import { currentActor } from "@/lib/inventory/actor";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  const artist = getArtistBySlug(slug);
  if (!artist) return NextResponse.json({ error: "Artista no encontrado" }, { status: 404 });
  return NextResponse.json({ profile: getProfile(artist.slug) });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const artist = getArtistBySlug(String(body?.slug ?? ""));
  if (!artist) return NextResponse.json({ error: "Artista no encontrado" }, { status: 404 });

  const names = { last: artist.artist_last, first: artist.artist_first ?? "" };
  const who = await currentActor();

  try {
    switch (body?.action) {
      // Candidate articles to choose from. Nothing is stored by looking.
      case "search":
        return NextResponse.json({
          candidates: await searchArtist(String(body.query ?? artist.name)),
        });

      case "link": {
        const article = await fetchArticle(
          (body.lang === "en" ? "en" : "es") as WikiLang,
          String(body.title ?? "")
        );
        if (!article) {
          return NextResponse.json(
            { error: "No se pudo leer ese artículo de Wikipedia" },
            { status: 400 }
          );
        }
        const profile = saveArticle(artist.slug, article, names);
        record({
          actor: who,
          action: "vincular wikipedia",
          entity: "artista",
          entityId: artist.slug,
          summary: `${artist.name} · ${article.title} (${article.lang})`,
        });
        return NextResponse.json({ profile });
      }

      case "unlink": {
        const profile = saveArticle(artist.slug, null, names);
        record({
          actor: who,
          action: "desvincular wikipedia",
          entity: "artista",
          entityId: artist.slug,
          summary: `${artist.name} ya no está vinculado a Wikipedia`,
        });
        return NextResponse.json({ profile });
      }

      /**
       * Copies one suggested value into the collection's own field. Deliberately
       * one field at a time and never automatic: this is the only path by which
       * anything from Wikipedia reaches the catalogue.
       */
      case "accept": {
        const field = String(body.field ?? "");
        const allowed = ["gender", "birth_date", "death_date", "nationality"] as const;
        if (!(allowed as readonly string[]).includes(field)) {
          return NextResponse.json({ error: "Campo no permitido" }, { status: 400 });
        }

        const before = getProfile(artist.slug);
        const value = String(body.value ?? "");
        const profile = saveProfile(artist.slug, { [field]: value }, names);

        record({
          actor: who,
          action: "aceptar dato de wikipedia",
          entity: "artista",
          entityId: artist.slug,
          summary: `${artist.name} · ${field} desde Wikipedia`,
          changes: [
            {
              field,
              label: field,
              before: String(before[field as keyof typeof before] ?? ""),
              after: value,
            },
          ],
        });
        return NextResponse.json({ profile });
      }

      case "save": {
        const before = getProfile(artist.slug);
        const patch: Record<string, string> = {};
        for (const key of ["gender", "birth_date", "death_date", "nationality", "notes"]) {
          if (body[key] !== undefined) patch[key] = String(body[key] ?? "").trim();
        }

        const profile = saveProfile(artist.slug, patch, names);
        const changes = Object.keys(patch)
          .filter((key) => before[key as keyof typeof before] !== patch[key])
          .map((key) => ({
            field: key,
            label: key,
            before: String(before[key as keyof typeof before] ?? ""),
            after: patch[key],
          }));

        if (changes.length > 0) {
          record({
            actor: who,
            action: "editar artista",
            entity: "artista",
            entityId: artist.slug,
            summary: `${artist.name} · ${changes.map((c) => c.field).join(", ")}`,
            changes,
          });
        }
        return NextResponse.json({ profile });
      }

      default:
        return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
