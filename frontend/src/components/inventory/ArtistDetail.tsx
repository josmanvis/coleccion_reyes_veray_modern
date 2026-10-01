"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { BookOpen, Check, CircleDollarSign, ExternalLink, Images, Link2Off, RefreshCw, Save, Search, User } from "lucide-react";
import { BADGE, BTN, BTN_PRIMARY, CARD, FIELD, LABEL, MUTED } from "./ui";
import { GENDERS, type ArtistProfile } from "@/lib/inventory/artist-fields";
import { useToast } from "./ToastProvider";
import { artworkCtx } from "./context-data";
import { useDateLocale, useTr } from "@/components/I18nProvider";
import ArtistMarketPanel, { type ArtistMarketData } from "./ArtistMarketPanel";

type Work = {
  ref: string;
  registro: string;
  title: string;
  year: string;
  medium: string;
  thumb: string | null;
};

type Candidate = { lang: "es" | "en"; title: string; description: string; snippet: string };

type Tab = "obras" | "datos" | "wiki" | "mercado";

export default function ArtistDetail({
  slug,
  name,
  works,
  profile: initial,
  market,
  initialTab,
}: {
  slug: string;
  name: string;
  works: Work[];
  profile: ArtistProfile;
  market: ArtistMarketData | null;
  initialTab?: string;
}) {
  const tr = useTr();
  const router = useRouter();
  const { notify } = useToast();
  const [tab, setTab] = useState<Tab>(initialTab === "mercado" && market ? "mercado" : "obras");
  const [profile, setProfile] = useState(initial);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [pending, setPending] = useState(false);

  async function call(body: Record<string, unknown>) {
    setPending(true);
    try {
      const response = await fetch("/api/admin/artist-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, ...body }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify(tr(data.error || "No se pudo completar"), "error");
        return null;
      }
      if (data.profile) {
        setProfile(data.profile);
        router.refresh();
      }
      return data;
    } finally {
      setPending(false);
    }
  }

  const tabs: Array<{ id: Tab; label: string; icon: typeof Images; count?: number }> = [
    { id: "obras", label: "Obras", icon: Images, count: works.length },
    { id: "datos", label: "Datos", icon: User },
    { id: "wiki", label: "Wikipedia", icon: BookOpen },
    ...(market ? [{ id: "mercado" as const, label: "Mercado", icon: CircleDollarSign, count: market.sales.length }] : []),
  ];

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label={tr("Secciones del artista")}
        className="flex gap-1 border-b border-[var(--stroke-soft)]"
      >
        {tabs.map((entry) => {
          const Icon = entry.icon;
          const active = tab === entry.id;
          return (
            <button
              key={entry.id}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setTab(entry.id)}
              className={`relative flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${
                active
                  ? "font-semibold text-[var(--brand)]"
                  : "text-[var(--ink-2)] hover:text-[var(--ink-1)]"
              }`}
            >
              <Icon size={15} strokeWidth={1.75} aria-hidden />
              {tr(entry.label)}
              {entry.count !== undefined && (
                <span className={`${MUTED} text-xs`}>({entry.count})</span>
              )}
              <span
                aria-hidden
                className={`absolute inset-x-2 -bottom-px h-0.5 rounded-full ${
                  active ? "bg-[var(--brand)]" : "bg-transparent"
                }`}
              />
            </button>
          );
        })}
      </div>

      {tab === "obras" && <WorksGrid works={works} />}

      {tab === "mercado" && market && <ArtistMarketPanel market={market} />}

      {tab === "datos" && (
        <ProfileForm
          profile={profile}
          pending={pending}
          onSave={(patch) => call({ action: "save", ...patch })}
        />
      )}

      {tab === "wiki" && (
        <WikiTab
          name={name}
          profile={profile}
          pending={pending}
          candidates={candidates}
          onSearch={async (query) => {
            const data = await call({ action: "search", query });
            setCandidates((data?.candidates as Candidate[]) ?? []);
          }}
          onLink={(candidate) =>
            call({ action: "link", lang: candidate.lang, title: candidate.title }).then(() =>
              setCandidates(null)
            )
          }
          onUnlink={() => call({ action: "unlink" })}
          onAccept={(field, value) => call({ action: "accept", field, value })}
        />
      )}
    </div>
  );
}

function WorksGrid({ works }: { works: Work[] }) {
  const tr = useTr();
  if (works.length === 0) {
    return (
      <div className={`${CARD} p-8 text-center`}>
        <p className={`text-sm ${MUTED}`}>{tr("No hay obras de este artista.")}</p>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
      {works.map((work) => (
        <li key={work.ref}>
          <Link
            href={`/inventory/${work.ref}`}
            {...artworkCtx({ ref: work.ref, registro: work.registro, title: work.title, image_thumb: work.thumb })}
            className={`${CARD} block overflow-hidden transition hover:shadow-[var(--shadow-8)]`}
          >
            <div className="grid aspect-square place-items-center bg-[var(--surface-alt)]">
              {work.thumb ? (
                <Image
                  src={work.thumb}
                  alt=""
                  width={220}
                  height={220}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className={`text-xs ${MUTED}`}>{tr("Sin imagen")}</span>
              )}
            </div>
            <div className="p-2.5">
              <p className="truncate text-sm font-medium text-[var(--ink-1)]">{work.title}</p>
              <p className={`mt-0.5 truncate text-xs ${MUTED}`}>
                {[`CRV ${work.registro}`, work.year].filter(Boolean).join(" · ")}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ProfileForm({
  profile,
  pending,
  onSave,
}: {
  profile: ArtistProfile;
  pending: boolean;
  onSave: (patch: Record<string, string>) => void;
}) {
  const tr = useTr();
  return (
    <form
      action={(form) =>
        onSave({
          gender: String(form.get("gender") ?? ""),
          birth_date: String(form.get("birth_date") ?? ""),
          death_date: String(form.get("death_date") ?? ""),
          nationality: String(form.get("nationality") ?? ""),
          notes: String(form.get("notes") ?? ""),
        })
      }
      className={`${CARD} p-4`}
    >
      <h2 className="text-sm font-semibold">{tr("Datos del artista")}</h2>
      <p className={`mt-1 text-sm ${MUTED}`}>
        
        {tr("El registro de la colección. Nada de Wikipedia llega aquí por su cuenta.")}
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label>
          <span className={LABEL}>{tr("Género")}</span>
          <select name="gender" defaultValue={profile.gender} className={FIELD}>
            {GENDERS.map((option) => (
              <option key={option.value} value={option.value}>
                {tr(option.label)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={LABEL}>{tr("Nacionalidad")}</span>
          <input name="nationality" defaultValue={profile.nationality} className={FIELD} />
        </label>
        <label>
          <span className={LABEL}>{tr("Nacimiento (AAAA, AAAA-MM o AAAA-MM-DD)")}</span>
          <input
            name="birth_date"
            defaultValue={profile.birth_date}
            placeholder="1938"
            className={FIELD}
          />
        </label>
        <label>
          <span className={LABEL}>{tr("Defunción")}</span>
          <input
            name="death_date"
            defaultValue={profile.death_date}
            placeholder={tr("En blanco si vive")}
            className={FIELD}
          />
        </label>
        <label className="sm:col-span-2">
          <span className={LABEL}>{tr("Notas")}</span>
          <textarea name="notes" defaultValue={profile.notes} rows={4} className={FIELD} />
        </label>
      </div>

      <div className="mt-3">
        <button type="submit" disabled={pending} className={BTN_PRIMARY}>
          <Save size={15} strokeWidth={1.75} aria-hidden />
          {pending ? tr("Guardando…") : tr("Guardar datos")}
        </button>
      </div>
    </form>
  );
}

/** One suggested value, with the button that copies it into the record. */
function Suggestion({
  label,
  value,
  current,
  onAccept,
  pending,
}: {
  label: string;
  value: string | null;
  current: string;
  onAccept: () => void;
  pending: boolean;
}) {
  const tr = useTr();
  if (!value) return null;
  const same = current === value;

  return (
    <li className="flex items-center gap-2 py-1 text-sm">
      <span className="w-28 shrink-0 text-xs font-semibold text-[var(--ink-2)]">{label}</span>
      <span className="text-[var(--ink-1)]">{value}</span>
      {same ? (
        <span className={`${BADGE.success} ml-auto`}>{tr("ya registrado")}</span>
      ) : (
        <button type="button" onClick={onAccept} disabled={pending} className={`${BTN} ml-auto`}>
          <Check size={14} strokeWidth={2} aria-hidden />
          {current ? tr("Reemplazar") : tr("Usar")}
        </button>
      )}
    </li>
  );
}

function WikiTab({
  name,
  profile,
  pending,
  candidates,
  onSearch,
  onLink,
  onUnlink,
  onAccept,
}: {
  name: string;
  profile: ArtistProfile;
  pending: boolean;
  candidates: Candidate[] | null;
  onSearch: (query: string) => void;
  onLink: (candidate: Candidate) => void;
  onUnlink: () => void;
  onAccept: (field: string, value: string) => void;
}) {
  const tr = useTr();
  const loc = useDateLocale();
  const wiki = profile.wiki;

  return (
    <div className="space-y-4">
      <form
        action={(form) => onSearch(String(form.get("query") ?? name))}
        className={`${CARD} flex flex-wrap items-end gap-3 p-4`}
      >
        <label className="min-w-[260px] flex-1">
          <span className={LABEL}>{tr("Buscar en Wikipedia")}</span>
          <input name="query" defaultValue={wiki?.title || name} className={FIELD} />
        </label>
        <button type="submit" disabled={pending} className={BTN_PRIMARY}>
          <Search size={15} strokeWidth={1.75} aria-hidden />
          {pending ? tr("Buscando…") : tr("Buscar")}
        </button>
        {wiki && (
          <button type="button" onClick={onUnlink} disabled={pending} className={BTN}>
            <Link2Off size={15} strokeWidth={1.75} aria-hidden />
            
            {tr("Desvincular")}
          </button>
        )}
      </form>

      {candidates !== null && (
        <div className={`${CARD} p-4`}>
          <h2 className="text-sm font-semibold">{tr("Resultados")}</h2>
          {candidates.length === 0 ? (
            <p className={`mt-2 text-sm ${MUTED}`}>{tr("Wikipedia no devolvió artículos.")}</p>
          ) : (
            <ul className="mt-2 divide-y divide-[var(--stroke-soft)]">
              {candidates.map((candidate) => (
                <li
                  key={`${candidate.lang}-${candidate.title}`}
                  className="flex items-start gap-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium text-[var(--ink-1)]">
                      {candidate.title}
                      <span className={BADGE.neutral}>{candidate.lang}</span>
                    </p>
                    <p className={`mt-0.5 line-clamp-2 text-sm ${MUTED}`}>{candidate.snippet}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onLink(candidate)}
                    disabled={pending}
                    className={BTN}
                  >
                    
                    {tr("Vincular")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {wiki ? (
        <div className={`${CARD} p-4`}>
          <div className="flex flex-wrap items-start gap-4">
            {wiki.thumbnail && (
              // Wikimedia serves these; they are not in the app's image config,
              // and an encyclopedia thumbnail needs no optimizing.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={wiki.thumbnail}
                alt={wiki.title}
                className="h-32 w-32 shrink-0 rounded-[var(--radius)] object-cover ring-1 ring-[var(--stroke)]"
              />
            )}
            <div className="min-w-0 flex-1">
              <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                {wiki.title}
                <span className={BADGE.neutral}>{wiki.lang}</span>
              </h2>
              {wiki.description && (
                <p className={`mt-0.5 text-sm ${MUTED}`}>{wiki.description}</p>
              )}
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[var(--ink-1)]">
                {wiki.extract}
              </p>
              <p className={`mt-3 text-xs ${MUTED}`}>
                
                {tr("Texto de Wikipedia (CC BY-SA), no de la colección.")}{" "}
                <a
                  href={wiki.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[var(--brand)] hover:underline"
                >
                  
                  {tr("Ver artículo")}
                  <ExternalLink size={12} strokeWidth={1.75} aria-hidden />
                </a>
              </p>
            </div>
          </div>

          {(wiki.suggestions.birthDate ||
            wiki.suggestions.deathDate ||
            wiki.suggestions.gender ||
            wiki.suggestions.nationality) && (
            <div className="mt-4 border-t border-[var(--stroke-soft)] pt-3">
              <h3 className="text-sm font-semibold">{tr("Datos sugeridos")}</h3>
              <p className={`mt-0.5 text-sm ${MUTED}`}>
                
                {tr("De Wikidata. Se copian al registro solo si lo decides, uno por uno.")}
              </p>
              <ul className="mt-2">
                <Suggestion
                  label={tr("Nacimiento")}
                  value={wiki.suggestions.birthDate}
                  current={profile.birth_date}
                  onAccept={() => onAccept("birth_date", wiki.suggestions.birthDate!)}
                  pending={pending}
                />
                <Suggestion
                  label={tr("Defunción")}
                  value={wiki.suggestions.deathDate}
                  current={profile.death_date}
                  onAccept={() => onAccept("death_date", wiki.suggestions.deathDate!)}
                  pending={pending}
                />
                <Suggestion
                  label={tr("Género")}
                  value={wiki.suggestions.gender}
                  current={profile.gender}
                  onAccept={() => onAccept("gender", wiki.suggestions.gender!)}
                  pending={pending}
                />
                <Suggestion
                  label={tr("Nacionalidad")}
                  value={wiki.suggestions.nationality}
                  current={profile.nationality}
                  onAccept={() => onAccept("nationality", wiki.suggestions.nationality!)}
                  pending={pending}
                />
              </ul>
            </div>
          )}

          {wiki.fetchedAt && (
            <p className={`mt-3 flex items-center gap-1 text-xs ${MUTED}`}>
              <RefreshCw size={11} strokeWidth={1.75} aria-hidden />
              {tr("Consultado el {date}", { date: new Date(wiki.fetchedAt).toLocaleDateString(loc) })}
            </p>
          )}
        </div>
      ) : (
        candidates === null && (
          <div className={`${CARD} p-8 text-center`}>
            <p className={`text-sm ${MUTED}`}>
              
              {tr("Este artista no está vinculado a Wikipedia todavía. Busca arriba para vincularlo.")}
            </p>
          </div>
        )
      )}
    </div>
  );
}
