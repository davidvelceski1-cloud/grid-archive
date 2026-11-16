import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { searchArchive } from "@/lib/queries";
import { runNlSearch } from "@/lib/nlsearch";
import { formatDate } from "@/lib/text";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Search", robots: { index: false } };

const LABEL: Record<string, string> = { driver: "Drivers", team: "Teams", season: "Seasons", circuit: "Circuits", race: "Races", era: "Eras", glossary: "Glossary" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; mode?: string }> }) {
  const { q = "", mode } = await searchParams;
  const term = q.trim().slice(0, 200);
  const nl = mode === "nl" || (term.split(/\s+/).length >= 4 && mode !== "basic");
  const [hits, nlResult, passages] = term
    ? await Promise.all([
        searchArchive(term, 12),
        nl ? runNlSearch(term) : Promise.resolve(null),
        prisma.$queryRaw<{ title: string; url: string; snippet: string }[]>`
          SELECT DISTINCT ON (url) title, url,
            ts_headline('english', content, plainto_tsquery('english', ${term}), 'MaxWords=30, MinWords=12, StartSel=<<, StopSel=>>') AS snippet
          FROM "Embedding" WHERE to_tsvector('english', title || ' ' || content) @@ plainto_tsquery('english', ${term})
          LIMIT 20`,
      ])
    : [[], null, []];
  const groups = Object.keys(LABEL).map((k) => ({ k, list: hits.filter((h) => h.type === k) })).filter((g) => g.list.length);

  return (
    <div className="shell pb-20 pt-10">
      <Breadcrumbs items={[{ label: "Search" }]} />
      <form role="search" action="/search" className="mt-10">
        <label htmlFor="sq" className="eyebrow-accent">Search the archive</label>
        <div className="mt-3 flex flex-wrap gap-3 border-b-2 border-white pb-2">
          <input id="sq" name="q" defaultValue={term} placeholder="Try “Ferrari wins in the rain in the 90s”" className="min-w-0 flex-1 bg-transparent py-2 font-display text-3xl font-bold tracking-tight placeholder:text-steel focus:outline-none sm:text-4xl" />
          <button className="btn" type="submit">Search</button>
        </div>
        <div className="mt-3 flex gap-2 text-sm">
          <label className="inline-flex items-center gap-2 text-mist"><input type="radio" name="mode" value="basic" defaultChecked={!nl} className="accent-[#E4002B]" /> Keyword</label>
          <label className="inline-flex items-center gap-2 text-mist"><input type="radio" name="mode" value="nl" defaultChecked={nl} className="accent-[#E4002B]" /> Natural language</label>
        </div>
      </form>

      {term && (
        <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-12">
            {nlResult && (
              <section aria-labelledby="nl">
                <h2 id="nl" className="eyebrow-accent">Understood as</h2>
                <ul className="mt-3 flex flex-wrap gap-2 text-sm">
                  {nlResult.filters.outcome !== "any" && <li className="chip">{nlResult.filters.outcome}s</li>}
                  {nlResult.filters.driverId && <li className="chip">driver: {nlResult.filters.driverId}</li>}
                  {nlResult.filters.teamId && <li className="chip">team: {nlResult.filters.teamId}</li>}
                  {nlResult.filters.circuitId && <li className="chip">circuit: {nlResult.filters.circuitId}</li>}
                  {nlResult.filters.yearFrom && <li className="chip">{nlResult.filters.yearFrom}–{nlResult.filters.yearTo}</li>}
                </ul>
                {nlResult.filters.explanation && <p className="mt-3 text-white/80">{nlResult.filters.explanation}</p>}
                {nlResult.filters.unsupported.length > 0 && (
                  <p className="mt-3 border-l-2 border-signal pl-3 text-sm text-mist">
                    The structured results don&apos;t record {nlResult.filters.unsupported.join(", ")}. Showing matching races below, plus archive passages that mention it.
                  </p>
                )}
                {nlResult.races.length > 0 && (
                  <div className="mt-6 overflow-x-auto">
                    <table className="table-archive">
                      <caption className="sr-only">Matching races</caption>
                      <thead><tr><th scope="col">Race</th><th scope="col">Date</th><th scope="col">Driver</th><th scope="col">Team</th><th scope="col" className="text-right">Pos</th></tr></thead>
                      <tbody>
                        {nlResult.races.map((r) => (
                          <tr key={`${r.id}-${r.driver}`}>
                            <td><Link href={`/seasons/${r.year}/${r.slug}`} className="link-quiet font-semibold">{r.year} {r.name}</Link></td>
                            <td className="text-mist">{formatDate(r.date)}</td>
                            <td>{r.driver}</td>
                            <td>{r.team}</td>
                            <td className="text-right">{r.position ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {nlResult.passages.length > 0 && (
                  <ul className="mt-6 space-y-4">
                    {nlResult.passages.slice(0, 6).map((p, i) => (
                      <li key={i} className="border-l border-rule pl-4">
                        <Link href={p.url} className="font-semibold text-white hover:text-signal-bright">{p.title}</Link>
                        <p className="mt-1 text-sm text-mist">{p.content.slice(0, 260)}…</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
            {groups.map((g) => (
              <section key={g.k} aria-labelledby={`g-${g.k}`}>
                <h2 id={`g-${g.k}`} className="eyebrow mb-3">{LABEL[g.k]}</h2>
                <ul className="divide-y divide-rule border-y border-rule">
                  {g.list.map((h) => (
                    <li key={h.href}>
                      <Link href={h.href} className="flex items-center gap-4 py-3 hover:bg-white/5">
                        <span className="h-12 w-16 shrink-0 bg-graphite" style={h.color ? { background: h.color } : undefined}>
                          {h.image && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={h.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                          )}
                        </span>
                        <span><span className="block font-bold">{h.title}</span><span className="block text-sm text-mist">{h.meta}</span></span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {passages.length > 0 && (
              <section aria-labelledby="passages">
                <h2 id="passages" className="eyebrow mb-3">In the articles</h2>
                <ul className="space-y-5">
                  {passages.map((p) => (
                    <li key={p.url}>
                      <Link href={p.url} className="font-semibold text-white hover:text-signal-bright">{p.title}</Link>
                      <p className="mt-1 text-sm text-mist">
                        {p.snippet.split(/(<<|>>)/).reduce<{ out: React.ReactNode[]; on: boolean }>((acc, part, i) => {
                          if (part === "<<") acc.on = true;
                          else if (part === ">>") acc.on = false;
                          else acc.out.push(acc.on ? <mark key={i} className="bg-signal/30 text-white">{part}</mark> : part);
                          return acc;
                        }, { out: [], on: false }).out}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {!groups.length && !passages.length && !nlResult?.races.length && <p className="text-mist">Nothing in the archive matches “{term}”.</p>}
          </div>
          <aside className="h-fit border border-rule bg-carbon p-5">
            <p className="eyebrow-accent">Prefer to ask?</p>
            <p className="mt-2 text-white/85">Ask the archive&apos;s AI assistant and get a cited answer.</p>
            <Link href={`/ask?q=${encodeURIComponent(term)}`} className="btn mt-4">Ask: “{term.slice(0, 30)}{term.length > 30 ? "…" : ""}”</Link>
          </aside>
        </div>
      )}
    </div>
  );
}
