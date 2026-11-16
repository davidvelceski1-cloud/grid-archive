"use client";

import { useEffect, useState } from "react";

export interface Bookmark {
  href: string;
  title: string;
  kind: string;
  savedAt: number;
}

const KEY = "grid-archive:bookmarks";

export function readBookmarks(): Bookmark[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Bookmark[];
  } catch {
    return [];
  }
}

export function writeBookmarks(list: Bookmark[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event("grid-archive:bookmarks"));
  } catch {
    /* storage unavailable */
  }
}

export function BookmarkButton({ href, title, kind }: { href: string; title: string; kind: string }) {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const sync = () => setSaved(readBookmarks().some((b) => b.href === href));
    sync();
    window.addEventListener("grid-archive:bookmarks", sync);
    return () => window.removeEventListener("grid-archive:bookmarks", sync);
  }, [href]);
  const toggle = () => {
    const list = readBookmarks();
    writeBookmarks(saved ? list.filter((b) => b.href !== href) : [{ href, title, kind, savedAt: Date.now() }, ...list]);
  };
  return (
    <button type="button" onClick={toggle} aria-pressed={saved} className="btn-ghost">
      <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z" /></svg>
      {saved ? "Saved to My Archive" : "Save"}
    </button>
  );
}

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* cancelled */
      }
    }
    await navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button type="button" onClick={share} className="btn-ghost">
      {copied ? "Link copied" : "Share"}
    </button>
  );
}

/** "Summarize this page" (short / detailed) — AI when configured, data summary otherwise. */
export function SummarizeButton({ type, id }: { type: string; id: string }) {
  const [state, setState] = useState<{ length: "short" | "detailed"; text: string | null; loading: boolean; error?: string } | null>(null);
  const run = async (length: "short" | "detailed") => {
    setState({ length, text: null, loading: true });
    try {
      const res = await fetch("/api/summarize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, id, length }) });
      const data = (await res.json()) as { summary?: string; error?: string };
      setState({ length, text: data.summary ?? null, loading: false, error: data.error });
    } catch {
      setState({ length, text: null, loading: false, error: "Summary unavailable." });
    }
  };
  return (
    <div className="mt-8 max-w-3xl">
      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow mr-1">Summarize this page</span>
        <button type="button" className="chip" aria-pressed={state?.length === "short"} onClick={() => run("short")}>Short</button>
        <button type="button" className="chip" aria-pressed={state?.length === "detailed"} onClick={() => run("detailed")}>Detailed</button>
      </div>
      {state && (
        <div className="mt-4 border-l-2 border-signal bg-black/50 p-4 text-[0.98rem] leading-relaxed text-white/90" aria-live="polite">
          {state.loading ? (
            <div className="space-y-2"><div className="skeleton h-3 w-full" /><div className="skeleton h-3 w-4/5" /></div>
          ) : (
            state.text ?? state.error
          )}
        </div>
      )}
    </div>
  );
}
