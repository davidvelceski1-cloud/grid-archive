"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

export interface TeamItem {
  slug: string;
  name: string;
  search: string;
  nationality: string | null;
  color: string;
  status: "ACTIVE" | "DEFUNCT" | "BECAME_ANOTHER_TEAM";
  firstYear: number | null;
  lastYear: number | null;
  entries: number;
  wins: number;
  titles: number;
  image: string | null;
  imageAlt: string | null;
}

const STATUS_LABEL = { ACTIVE: "Active", DEFUNCT: "Defunct", BECAME_ANOTHER_TEAM: "Became another team" } as const;

export function TeamsBrowser({ teams }: { teams: TeamItem[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "all";
  const nat = params.get("nat") ?? "";
  const decade = params.get("decade") ?? "";
  const champs = params.get("champions") === "1";
  const sort = params.get("sort") ?? "entries";

  const set = (k: string, v: string | null) => {
    const p = new URLSearchParams(params.toString());
    if (v === null || v === "" || v === "all") p.delete(k);
    else p.set(k, v);
    router.replace(`/teams${p.toString() ? `?${p}` : ""}`, { scroll: false });
  };

  const nationalities = useMemo(() => [...new Set(teams.map((t) => t.nationality).filter(Boolean) as string[])].sort(), [teams]);
  const decades = useMemo(() => {
    const max = Math.max(...teams.map((t) => t.lastYear ?? 0));
    const out: number[] = [];
    for (let d = 1950; d <= max; d += 10) out.push(d);
    return out;
  }, [teams]);

  const filtered = useMemo(() => {
    const key = q.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    return teams
      .filter((t) => !key || t.search.includes(key))
      .filter((t) => status === "all" || (status === "active" ? t.status === "ACTIVE" : t.status !== "ACTIVE"))
      .filter((t) => !nat || t.nationality === nat)
      .filter((t) => !decade || ((t.firstYear ?? 0) <= Number(decade) + 9 && (t.lastYear ?? 0) >= Number(decade)))
      .filter((t) => !champs || t.titles > 0)
      .sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : sort === "wins" ? b.wins - a.wins : sort === "recent" ? (b.lastYear ?? 0) - (a.lastYear ?? 0) : b.entries - a.entries));
  }, [teams, q, status, nat, decade, champs, sort]);

  return (
    <div>
      <div className="sticky top-16 z-20 -mx-4 border-y border-rule bg-ink/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <div className="flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor="team-q">Search teams</label>
          <input id="team-q" type="search" defaultValue={q} onChange={(e) => set("q", e.target.value)} placeholder="Search teams…" className="w-full border border-rule bg-carbon px-3 py-2 text-white placeholder:text-steel focus:border-white focus:outline-none sm:w-64" />
          <div className="flex gap-1" role="group" aria-label="Status">
            {[["all", "All"], ["active", "Active"], ["defunct", "Defunct"]].map(([v, l]) => (
              <button key={v} type="button" className="chip" aria-pressed={status === v} onClick={() => set("status", v)}>{l}</button>
            ))}
          </div>
          <button type="button" className="chip" aria-pressed={champs} onClick={() => set("champions", champs ? null : "1")}>Champions</button>
          <label className="sr-only" htmlFor="team-nat">Nationality</label>
          <select id="team-nat" value={nat} onChange={(e) => set("nat", e.target.value)} className="border border-rule bg-carbon px-3 py-2 text-sm text-white">
            <option value="">All nationalities</option>
            {nationalities.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <label className="sr-only" htmlFor="team-decade">Decade active</label>
          <select id="team-decade" value={decade} onChange={(e) => set("decade", e.target.value)} className="border border-rule bg-carbon px-3 py-2 text-sm text-white">
            <option value="">Any decade</option>
            {decades.map((d) => <option key={d} value={d}>{d}s</option>)}
          </select>
          <label className="sr-only" htmlFor="team-sort">Sort</label>
          <select id="team-sort" value={sort} onChange={(e) => set("sort", e.target.value)} className="border border-rule bg-carbon px-3 py-2 text-sm text-white">
            <option value="entries">Most races</option>
            <option value="wins">Most wins</option>
            <option value="recent">Most recent</option>
            <option value="name">A–Z</option>
          </select>
          <p className="ml-auto text-sm text-mist" aria-live="polite">{filtered.length} teams</p>
        </div>
      </div>

      <ul className="mt-8 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        {filtered.map((t) => (
          <li key={t.slug}>
            <Link href={`/teams/${t.slug}`} className="card-zoom group block">
              <div className="relative aspect-[16/10] overflow-hidden" style={{ background: `linear-gradient(135deg, ${t.color}, #0b0d10 85%)` }}>
                {t.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.image} alt={t.imageAlt ?? `${t.name} car`} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span className="absolute bottom-3 left-4 font-display text-2xl font-extrabold uppercase text-white/90">{t.name}</span>
                )}
                <span className="absolute inset-x-0 top-0 h-1" style={{ background: t.color }} aria-hidden="true" />
                <span className={`absolute right-0 top-1 px-2 py-1 text-[0.6rem] font-bold uppercase tracking-[0.14em] ${t.status === "ACTIVE" ? "bg-signal text-white" : "bg-black/70 text-mist"}`}>{STATUS_LABEL[t.status]}</span>
              </div>
              <div className="border-b border-rule py-3">
                <p className="text-[0.66rem] font-bold uppercase tracking-[0.16em] text-mist">{t.nationality} · {t.firstYear}–{t.lastYear}</p>
                <p className="mt-1 font-display text-lg font-bold text-white group-hover:text-signal-bright">{t.name}</p>
                <p className="text-sm text-mist">{t.entries} races · {t.wins} wins{t.titles ? ` · ${t.titles} titles` : ""}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {filtered.length === 0 && <p className="mt-10 text-mist">No teams match these filters.</p>}
    </div>
  );
}
