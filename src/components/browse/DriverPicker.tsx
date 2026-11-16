"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { SearchHit } from "../SearchOverlay";

/** Add/remove up to 3 drivers for the comparison tool (URL: ?d=slug,slug,slug). */
export function DriverPicker({ selected }: { selected: { slug: string; name: string }[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d: { hits: SearchHit[] }) => setHits(d.hits.filter((h) => h.type === "driver")))
        .catch(() => {});
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const go = (slugs: string[]) => router.push(`/drivers/compare${slugs.length ? `?d=${slugs.join(",")}` : ""}`);

  return (
    <div className="flex flex-wrap items-start gap-3">
      {selected.map((s, i) => (
        <span key={s.slug} className="inline-flex items-center gap-2 border border-rule bg-carbon py-2 pl-3 pr-2 text-sm font-bold">
          <span className="h-3 w-3" style={{ background: ["#3987e5", "#d95926", "#199e70"][i] }} aria-hidden="true" />
          {s.name}
          <button type="button" onClick={() => go(selected.filter((x) => x.slug !== s.slug).map((x) => x.slug))} className="px-1 text-mist hover:text-white" aria-label={`Remove ${s.name}`}>
            ×
          </button>
        </span>
      ))}
      {selected.length < 3 && (
        <div className="relative w-full sm:w-72">
          <label htmlFor="cmp-q" className="sr-only">Add a driver</label>
          <input id="cmp-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add a driver…" autoComplete="off" className="w-full border border-rule bg-ink px-3 py-2 text-white placeholder:text-steel focus:border-white focus:outline-none" />
          {hits.length > 0 && (
            <ul className="absolute inset-x-0 top-full z-30 border border-rule bg-carbon shadow-xl" role="listbox">
              {hits.map((h) => {
                const slug = h.href.split("/").pop()!;
                return (
                  <li key={h.href} role="option" aria-selected="false">
                    <button type="button" onClick={() => { setQ(""); go([...selected.map((s) => s.slug), slug]); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-white/10">
                      <span className="font-semibold">{h.title}</span>
                      <span className="block text-xs text-mist">{h.meta}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
