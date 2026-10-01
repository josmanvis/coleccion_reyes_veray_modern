import { listArtworks } from "./db";
import { artistName, normalizeText, titleCase } from "./fields";
import { listArtists, listPortfolios } from "./public";
import { listBuildings, listUnits } from "./locations";
import { listPages } from "./pages";

/**
 * One search across everything the admin manages.
 *
 * Artworks go through the existing fuzzy index so a typo still finds them; the
 * other entities are small enough to scan and match on a normalized substring,
 * which keeps their results exact and predictable.
 */

export type OmniKind = "obra" | "artista" | "portafolio" | "ubicacion" | "pagina";

export type OmniHit = {
  kind: OmniKind;
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

export type OmniResults = {
  query: string;
  total: number;
  groups: Array<{ kind: OmniKind; label: string; hits: OmniHit[] }>;
};

export const KIND_LABELS: Record<OmniKind, string> = {
  obra: "Obras",
  artista: "Artistas",
  portafolio: "Portafolios",
  ubicacion: "Ubicaciones",
  pagina: "Páginas",
};

const PER_GROUP = 5;

function matches(haystack: string, needle: string): boolean {
  return normalizeText(haystack).includes(needle);
}

export function omniSearch(query: string): OmniResults {
  const trimmed = query.trim();
  const needle = normalizeText(trimmed);
  if (needle.length < 2) return { query: trimmed, total: 0, groups: [] };

  // Artworks: reuse the fuzzy index rather than a second matching rule.
  const artworks = listArtworks({ q: trimmed, limit: PER_GROUP }).rows.map<OmniHit>((row) => ({
    kind: "obra",
    id: String(row.ref),
    title: row.title ? titleCase(String(row.title)) : "Sin título",
    subtitle: [`CRV ${row.registro}`, artistName(row), row.year].filter(Boolean).join(" · "),
    href: `/inventory/${row.ref}`,
  }));

  const artists = listArtists()
    .filter((artist) => matches(artist.name, needle) || matches(artist.artist_last, needle))
    .slice(0, PER_GROUP)
    .map<OmniHit>((artist) => ({
      kind: "artista",
      id: artist.slug,
      title: artist.name,
      subtitle: `${artist.workCount} obra${artist.workCount === 1 ? "" : "s"}`,
      // The artist's own page, which carries their works, their dates and the
      // Wikipedia tab — not a filtered inventory listing.
      href: `/admin/artists/${encodeURIComponent(artist.slug)}`,
    }));

  const portfolios = listPortfolios()
    .filter((p) => matches(p.title, needle) || matches(p.base, needle))
    .slice(0, PER_GROUP)
    .map<OmniHit>((p) => ({
      kind: "portafolio",
      id: p.base,
      title: p.title,
      subtitle: `CRV ${p.base} · ${p.members.length} hojas`,
      // The portfolio's own page in the admin, not the public one: the public
      // site is off, so `/${p.slug}` only ever bounced back to the inventory.
      href: `/admin/portfolios/${encodeURIComponent(p.base)}`,
    }));

  const buildings = listBuildings();
  const buildingHits = buildings
    .filter((b) => matches(b.code, needle) || matches(b.name ?? "", needle))
    .slice(0, PER_GROUP)
    .map<OmniHit>((b) => ({
      kind: "ubicacion",
      id: `b${b.id}`,
      title: b.name ? `${b.code} — ${b.name}` : b.code,
      subtitle: "Edificio",
      href: "/admin/locations",
    }));

  const unitHits = listUnits()
    .filter((unit) => matches(unit.label, needle) || matches(unit.building, needle))
    .slice(0, PER_GROUP)
    .map<OmniHit>((unit) => ({
      kind: "ubicacion",
      id: `u${unit.id}`,
      title: unit.label,
      subtitle: [unit.building, unit.room].filter(Boolean).join(" · ") || "Ubicación",
      href: `/inventory?location=${encodeURIComponent(unit.label)}`,
    }));

  const locations = [...buildingHits, ...unitHits].slice(0, PER_GROUP);

  const pages = listPages()
    .filter((page) => matches(page.title, needle) || matches(page.slug, needle))
    .slice(0, PER_GROUP)
    .map<OmniHit>((page) => ({
      kind: "pagina",
      id: page.slug,
      title: page.title,
      subtitle: `/${page.slug} · ${page.status === "published" ? "Publicada" : "Borrador"}`,
      href: `/admin/content/${page.slug}`,
    }));

  const groups = (
    [
      { kind: "obra" as const, hits: artworks },
      { kind: "artista" as const, hits: artists },
      { kind: "portafolio" as const, hits: portfolios },
      { kind: "ubicacion" as const, hits: locations },
      { kind: "pagina" as const, hits: pages },
    ] satisfies Array<{ kind: OmniKind; hits: OmniHit[] }>
  )
    .filter((group) => group.hits.length > 0)
    .map((group) => ({ ...group, label: KIND_LABELS[group.kind] }));

  return {
    query: trimmed,
    total: groups.reduce((sum, group) => sum + group.hits.length, 0),
    groups,
  };
}
