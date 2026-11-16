"use client";

import { useState } from "react";

export interface Term {
  slug: string;
  term: string;
  category: string;
  short: string;
  long: string;
  eli5: string;
}

/** Glossary with a global "Explain like I'm new to F1" toggle plus an AI explainer for any other term. */
export function GlossaryList({ terms }: { terms: Term[] }) {
  const [eli5, setEli5] = useState(false);
  const [cat, setCat] = useState("All");
  const [ask, setAsk] = useState("");
  const [answer, setAnswer] = useState<{ term: string; text: string | null } | null>(null);
  const cats = ["All", ...new Set(terms.map((t) => t.category))];

  const explain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ask.trim()) return;
    setAnswer({ term: ask, text: null });
    const res = await fetch(`/api/explain?term=${encodeURIComponent(ask.trim())}`);
    const data = (await res.json()) as { explanation: string | null };
    setAnswer({ term: ask, text: data.explanation ?? "No explanation available for that term (AI explanations need an API key on the server)." });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-y border-rule py-4">
        <button type="button" className="chip" aria-pressed={eli5} onClick={() => setEli5((x) => !x)}>
          Explain like I&apos;m new to F1
        </button>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Category">
          {cats.map((c) => <button key={c} type="button" className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}
        </div>
        <form onSubmit={explain} className="ml-auto flex w-full gap-2 sm:w-auto">
          <label htmlFor="explain-q" className="sr-only">Explain another term</label>
          <input id="explain-q" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Explain any term… e.g. blown diffuser" className="flex-1 border border-rule bg-carbon px-3 py-2 text-sm text-white placeholder:text-steel focus:border-white focus:outline-none sm:w-64" />
          <button type="submit" className="btn py-2">Explain</button>
        </form>
      </div>
      {answer && (
        <div className="mt-6 border-l-2 border-signal bg-carbon p-5" aria-live="polite">
          <p className="eyebrow-accent">{answer.term}</p>
          {answer.text ? <p className="mt-2 text-lg">{answer.text}</p> : <div className="mt-3 space-y-2"><div className="skeleton h-3 w-3/4" /><div className="skeleton h-3 w-1/2" /></div>}
        </div>
      )}
      <dl className="mt-8 divide-y divide-rule border-b border-rule">
        {terms.filter((t) => cat === "All" || t.category === cat).map((t) => (
          <div key={t.slug} id={t.slug} className="grid scroll-mt-24 gap-2 py-6 target:bg-signal/10 sm:grid-cols-[18rem_1fr]">
            <dt>
              <span className="eyebrow">{t.category}</span>
              <span className="mt-1 block font-display text-xl font-bold">{t.term}</span>
            </dt>
            <dd className="text-white/85">
              {eli5 ? (
                <p className="text-lg"><span className="mr-2 inline-block bg-signal px-1.5 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-white">New to F1</span>{t.eli5}</p>
              ) : (
                <>
                  <p className="text-lg font-semibold text-white">{t.short}</p>
                  <p className="mt-2">{t.long}</p>
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
