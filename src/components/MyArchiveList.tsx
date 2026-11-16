"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readBookmarks, writeBookmarks, type Bookmark } from "./PageTools";

export function MyArchiveList() {
  const [list, setList] = useState<Bookmark[] | null>(null);
  useEffect(() => {
    const sync = () => setList(readBookmarks());
    sync();
    window.addEventListener("grid-archive:bookmarks", sync);
    return () => window.removeEventListener("grid-archive:bookmarks", sync);
  }, []);
  if (list === null) return <div className="skeleton h-24" />;
  if (!list.length) return <p className="text-mist">Nothing saved yet. Use the “Save” button on any season, team, driver, circuit or race page.</p>;
  const kinds = [...new Set(list.map((b) => b.kind))];
  return (
    <div className="space-y-10">
      {kinds.map((k) => (
        <section key={k} aria-label={k}>
          <h2 className="eyebrow mb-3">{k}s</h2>
          <ul className="divide-y divide-rule border-y border-rule">
            {list.filter((b) => b.kind === k).map((b) => (
              <li key={b.href} className="flex items-center gap-4 py-3">
                <Link href={b.href} className="flex-1 font-display text-xl font-bold hover:text-signal-bright">{b.title}</Link>
                <span className="hidden text-xs text-mist sm:block">Saved {new Date(b.savedAt).toLocaleDateString("en-GB")}</span>
                <button type="button" onClick={() => writeBookmarks(list.filter((x) => x.href !== b.href))} className="chip" aria-label={`Remove ${b.title}`}>Remove</button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <button type="button" className="btn-ghost" onClick={() => writeBookmarks([])}>Clear all</button>
    </div>
  );
}
