"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

export interface DriverItem {
  slug: string;
  name: string;
  family: string;
  search: string;
  nationality: string | null;
  firstYear: number | null;
  lastYear: number | null;
  starts: number;
  wins: number;
  titles: number;
  active: boolean;
  image: string | null;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

export function DriversBrowser({ drivers }: { drivers: DriverItem[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState(params.get("q") ?? "");
  const nat = params.get("nat") ?? "";
  const decade = params.get("decade") ?? "";
  const champs = params.get("champions") === "1";
  const status = params.get("status") ?? "all";
  const view = params.get("view") ?? (champs ? "grid" : "index");

  const set = (k: string, v: string | null) => {
    const p = new URLSearchParams(params.toString());
    if (!v || v === "all") p.delete(k);
    else p.set(k, v);
    router.replace(`/drivers${p.toString() ? `?${p}` : ""}`, { scroll: false });
  };

  const nationalities = useMemo(() => [...new Set(drivers.map((d) => d.nationality).filter(Boolean) as string[])].sort(), [drivers]);
  const filtered = useMemo(() => {
    const key = q.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
    return drivers
      .filter((d) => !key || d.search.includes(key))
      .filter((d) => !nat || d.nationality === nat)
      .filter((d) => !decade || ((d.firstYear ?? 0) <= Number(decade) + 9 && (d.lastYear ?? 0) >= Number(decade)))
      .filter((d) => !champs || d.titles > 0)
      .filter((d) => status === "all" || (status === "active" ? d.active : !d.active));
  }, [drivers, q, nat, decade, champs, status]);

  const suggestions = q.trim().length >= 2 ? [...filtered].sort((a, b) => b.starts - a.starts).slice(0, 6) : [];
  const byLetter = useMemo(() => {
    const m = new Map<string, DriverItem[]>();
    for (const d of [...filtered].sort((a, b) => fold(a.family).localeCompare(fold(b.family)) || a.name.localeCompare(b.name))) {
      const l = fold(d.family)[0] ?? "#";
      m.set(l, [...(m.get(l) ?? []), d]);
    }
    return m;
  }, [filtered]);

  return (
    <div>
      <div className="sticky top-16 z-20 -mx-4 border-y border-rule bg-ink/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-72">
            <label className="sr-only" htmlFor="driver-q">Search drivers</label>
            <input
              id="driver-q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search drivers…"
              autoComplete="off"
              aria-autocomplete="list"
              aria-controls="driver-suggest"
              className="w-full border border-rule bg-carbon px-3 py-2 text-white placeholder:text-steel focus:border-white focus:outline-none"
            />
            {suggestions.length > 0 && (
              <ul id="driver-suggest" role="listbox" className="absolute inset-x-0 top-full z-30 border border-rule bg-carbon shadow-xl">
                {suggestions.map((d) => (
                  <li key={d.slug} role="option" aria-selected="false">
                    <Link href={`/drivers/${d.slug}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-white/10">
                      <span className="font-semibold">{d.name}</span>
                      <span className="text-xs text-mist">{d.firstYear}–{d.lastYear}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button type="button" className="chip" aria-pressed={champs} onClick={() => set("champions", champs ? null : "1")}>World Champions</button>
          <div className="flex gap-1" role="group" aria-label="Career status">
            {[["all", "All"], ["active", "Active"], ["retired", "Retired"]].map(([v, l]) => (
              <button key={v} type="button" className="chip" aria-pressed={status === v} onClick={() => set("status", v)}>{l}</button>
            ))}
          </div>
          <label className="sr-only" htmlFor="driver-nat">Nationality</label>
          <select id="driver-nat" value={nat} onChange={(e) => set("nat", e.target.value)} className="border border-rule bg-carbon px-3 py-2 text-sm">
            <option value="">All nationalities</option>
            {nationalities.map((n) => <option key={n}>{n}</option>)}
          </select>
          <label className="sr-only" htmlFor="driver-decade">Decade</label>
          <select id="driver-decade" value={decade} onChange={(e) => set("decade", e.target.value)} className="border border-rule bg-carbon px-3 py-2 text-sm">
            <option value="">Any decade</option>
            {[1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020].map((d) => <option key={d} value={d}>{d}s</option>)}
          </select>
          <div className="flex gap-1" role="group" aria-label="View">
            <button type="button" className="chip" aria-pressed={view === "index"} onClick={() => set("view", "index")}>A–Z</button>
            <button type="button" className="chip" aria-pressed={view === "grid"} onClick={() => set("view", "grid")}>Portraits</button>
          </div>
          <p className="ml-auto text-sm text-mist" aria-live="polite">{filtered.length} drivers</p>
        </div>
        {view === "index" && (
          <nav aria-label="Jump to letter" className="mt-3 flex flex-wrap gap-1 text-sm font-bold">
            {LETTERS.map((l) => (byLetter.has(l) ? <a key={l} href={`#l-${l}`} className="w-7 py-1 text-center hover:bg-signal">{l}</a> : <span key={l} className="w-7 py-1 text-center text-steel">{l}</span>))}
          </nav>
        )}
      </div>

      {view === "grid" ? (
        <ul className="mt-8 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-4 lg:grid-cols-6">
          {[...filtered].sort((a, b) => b.titles - a.titles || b.wins - a.wins || b.starts - a.starts).slice(0, 240).map((d) => (
            <li key={d.slug}>
              <Link href={`/drivers/${d.slug}`} className="card-zoom group block">
                <div className="aspect-[4/5] overflow-hidden bg-graphite">
                  {d.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.image} alt={`Portrait of ${d.name}`} loading="lazy" className="h-full w-full object-cover grayscale-[30%] group-hover:grayscale-0" />
                  ) : (
                    <div className="flex h-full items-center justify-center font-display text-4xl font-extrabold text-white/30">{d.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</div>
                  )}
                </div>
                <p className="mt-2 font-bold leading-tight group-hover:text-signal-bright">{d.name}</p>
                <p className="text-xs text-mist">{d.nationality} · {d.firstYear}–{d.lastYear}{d.titles ? ` · ${d.titles}× champion` : ""}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-8 space-y-10">
          {[...byLetter].map(([letter, list]) => (
            <section key={letter} id={`l-${letter}`} className="scroll-mt-48" aria-labelledby={`h-${letter}`}>
              <h2 id={`h-${letter}`} className="stat-num border-b border-rule pb-2 text-4xl text-signal-bright">{letter}</h2>
              <ul className="mt-3 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
                {list.map((d) => (
                  <li key={d.slug} className="border-b border-rule/60">
                    <Link href={`/drivers/${d.slug}`} className="flex items-baseline justify-between gap-3 py-2 hover:text-signal-bright">
                      <span>
                        <span className="font-semibold">{d.family}</span>
                        <span className="text-white/70">, {d.name.replace(new RegExp(`\\s*${d.family.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`), " ").trim()}</span>
                        {d.titles > 0 && <span className="ml-1 text-signal-bright" title={`${d.titles}× World Champion`}>★</span>}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-mist">{d.firstYear}–{d.lastYear}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
