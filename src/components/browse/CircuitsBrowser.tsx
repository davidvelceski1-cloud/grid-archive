"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

export interface CircuitItem {
  slug: string;
  name: string;
  locality: string | null;
  country: string | null;
  type: "PERMANENT" | "STREET" | "ROAD";
  active: boolean;
  races: number;
  firstYear: number | null;
  lastYear: number | null;
  image: string | null;
  map: string | null;
}

const TYPE_LABEL = { PERMANENT: "Permanent", STREET: "Street", ROAD: "Road course" } as const;

export function CircuitsBrowser({ circuits }: { circuits: CircuitItem[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const status = params.get("status") ?? "all";
  const type = params.get("type") ?? "";
  const country = params.get("country") ?? "";
  const set = (k: string, v: string | null) => {
    const p = new URLSearchParams(params.toString());
    if (!v || v === "all") p.delete(k);
    else p.set(k, v);
    router.replace(`/circuits${p.toString() ? `?${p}` : ""}#grid`, { scroll: false });
  };
  const countries = useMemo(() => [...new Set(circuits.map((c) => c.country).filter(Boolean) as string[])].sort(), [circuits]);
  const filtered = circuits
    .filter((c) => status === "all" || (status === "active" ? c.active : !c.active))
    .filter((c) => !type || c.type === type)
    .filter((c) => !country || c.country === country);

  return (
    <div id="grid" className="scroll-mt-20">
      <div className="flex flex-wrap items-center gap-3 border-y border-rule py-4">
        <div className="flex gap-1" role="group" aria-label="Status">
          {[["all", "All"], ["active", "Active"], ["historic", "Historic"]].map(([v, l]) => (
            <button key={v} type="button" className="chip" aria-pressed={status === v} onClick={() => set("status", v)}>{l}</button>
          ))}
        </div>
        <div className="flex gap-1" role="group" aria-label="Type">
          {[["", "Any type"], ["PERMANENT", "Permanent"], ["STREET", "Street"], ["ROAD", "Road"]].map(([v, l]) => (
            <button key={v} type="button" className="chip" aria-pressed={type === v} onClick={() => set("type", v)}>{l}</button>
          ))}
        </div>
        <label className="sr-only" htmlFor="c-country">Country</label>
        <select id="c-country" value={country} onChange={(e) => set("country", e.target.value)} className="border border-rule bg-carbon px-3 py-2 text-sm">
          <option value="">All countries</option>
          {countries.map((c) => <option key={c}>{c}</option>)}
        </select>
        <p className="ml-auto text-sm text-mist" aria-live="polite">{filtered.length} circuits</p>
      </div>
      <ul className="mt-8 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        {filtered.map((c) => (
          <li key={c.slug}>
            <Link href={`/circuits/${c.slug}`} className="card-zoom group block">
              <div className="relative aspect-[16/10] overflow-hidden bg-graphite">
                {c.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.image} alt={`View of ${c.name}`} loading="lazy" className="h-full w-full object-cover" />
                ) : c.map ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.map} alt={`Layout of ${c.name}`} loading="lazy" className="h-full w-full bg-white object-contain p-4" />
                ) : (
                  <div className="flex h-full items-center justify-center text-mist">No image</div>
                )}
                {c.active && <span className="absolute left-0 top-0 bg-signal px-2 py-1 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-white">On the calendar</span>}
              </div>
              <div className="border-b border-rule py-3">
                <p className="text-[0.66rem] font-bold uppercase tracking-[0.16em] text-mist">{[c.country, TYPE_LABEL[c.type]].filter(Boolean).join(" · ")}</p>
                <p className="mt-1 font-display text-lg font-bold leading-tight group-hover:text-signal-bright">{c.name}</p>
                <p className="text-sm text-mist">{c.races} Grands Prix · {c.firstYear}{c.lastYear !== c.firstYear ? `–${c.lastYear}` : ""}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
