"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export interface SearchHit {
  type: "season" | "team" | "driver" | "circuit" | "race" | "era" | "glossary";
  title: string;
  meta: string;
  href: string;
  image?: string | null;
  color?: string | null;
}

const GROUPS: { type: SearchHit["type"]; label: string }[] = [
  { type: "driver", label: "Drivers" },
  { type: "team", label: "Teams" },
  { type: "season", label: "Seasons" },
  { type: "circuit", label: "Circuits" },
  { type: "race", label: "Races" },
  { type: "era", label: "Eras" },
  { type: "glossary", label: "Glossary" },
];

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(-1);

  useEffect(() => {
    if (open) {
      setTimeout(() => input.current?.focus(), 10);
      document.body.style.overflow = "hidden";
    } else document.body.style.overflow = "";
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d: { hits: SearchHit[] }) => {
          setHits(d.hits);
          setCursor(-1);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 140);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  if (!open) return null;

  const ordered = GROUPS.flatMap((g) => hits.filter((h) => h.type === g.type));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cursor >= 0 && ordered[cursor]) router.push(ordered[cursor].href);
    else if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-ink/[0.97]" role="dialog" aria-modal="true" aria-label="Search the archive">
      <div className="shell py-6">
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="p-2 text-mist hover:text-white" aria-label="Close search">
            <svg width="28" height="28" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19" /></svg>
          </button>
        </div>
        <form onSubmit={submit} role="search" className="mx-auto mt-6 max-w-4xl">
          <label htmlFor="global-search" className="eyebrow-accent">Search the archive</label>
          <div className="mt-3 flex items-center border-b-2 border-white">
            <input
              ref={input}
              id="global-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, ordered.length - 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, -1)); }
              }}
              placeholder="Senna, Brabham, 1976, Monza…"
              autoComplete="off"
              role="combobox"
              aria-expanded={ordered.length > 0}
              aria-controls="search-results"
              aria-activedescendant={cursor >= 0 ? `hit-${cursor}` : undefined}
              className="w-full bg-transparent py-4 font-display text-3xl font-bold tracking-tight text-white placeholder:text-steel focus:outline-none sm:text-5xl"
            />
            {loading && <span className="h-5 w-5 animate-spin border-2 border-signal border-t-transparent" aria-label="Loading" />}
          </div>
          <p className="mt-3 text-sm text-mist">
            Press Enter for full results, or{" "}
            <Link href={`/ask${q ? `?q=${encodeURIComponent(q)}` : ""}`} onClick={onClose} className="link">ask the archive in plain language</Link>.
          </p>
        </form>

        <div id="search-results" role="listbox" className="mx-auto mt-10 max-w-4xl space-y-8">
          {GROUPS.map((g) => {
            const list = hits.filter((h) => h.type === g.type);
            if (!list.length) return null;
            return (
              <section key={g.type} aria-label={g.label}>
                <h2 className="eyebrow mb-3">{g.label}</h2>
                <ul className="divide-y divide-rule border-y border-rule">
                  {list.map((h) => {
                    const idx = ordered.indexOf(h);
                    return (
                      <li key={h.href} id={`hit-${idx}`} role="option" aria-selected={cursor === idx}>
                        <Link href={h.href} onClick={onClose} className={`flex items-center gap-4 px-2 py-3 hover:bg-white/5 ${cursor === idx ? "bg-white/10" : ""}`}>
                          <span className="h-12 w-16 shrink-0 overflow-hidden bg-graphite" style={h.color ? { background: h.color } : undefined}>
                            {h.image && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={h.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-bold text-white">{h.title}</span>
                            <span className="block truncate text-sm text-mist">{h.meta}</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          {q.trim().length >= 2 && !loading && hits.length === 0 && <p className="text-mist">No direct matches. Press Enter to search articles, or ask the archive.</p>}
        </div>
      </div>
    </div>
  );
}
