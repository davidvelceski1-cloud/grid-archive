import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSeason, gridOf, progression } from "@/lib/seasonData";
import { articleSources, getArticle } from "@/lib/queries";
import { formatDate, formatPoints } from "@/lib/text";
import { ArticleSection, FactStrip, PageHero, SectionHeading } from "@/components/PageBlocks";
import { BookmarkButton, ShareButton, SummarizeButton } from "@/components/PageTools";
import { SortableTable } from "@/components/SortableTable";
import { ProgressionChart } from "@/components/charts/Charts";
import { SetPageContext } from "@/components/chat/pageContext";
import { ArchiveImage } from "@/components/ArchiveImage";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const seasons = await prisma.season.findMany({ select: { year: true } });
    return seasons.map((s) => ({ year: String(s.year) }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ year: string }> }): Promise<Metadata> {
  const { year } = await params;
  const s = await getSeason(Number(year));
  if (!s) return { title: "Season not found" };
  const desc = `${s.headline ?? ""} Race-by-race results, standings and the story of the ${year} Formula 1 World Championship.`.trim();
  return { title: `${year} season`, description: desc, openGraph: { title: `The ${year} Formula 1 season`, description: desc }, alternates: { canonical: `/seasons/${year}` } };
}

export default async function SeasonPage({ params }: { params: Promise<{ year: string }> }) {
  const { year: y } = await params;
  const year = Number(y);
  if (!Number.isInteger(year)) notFound();
  const season = await getSeason(year);
  if (!season) notFound();

  const [article, prev, next] = await Promise.all([
    getArticle("SEASON", String(year)),
    prisma.season.findUnique({ where: { year: year - 1 }, select: { year: true } }),
    prisma.season.findUnique({ where: { year: year + 1 }, select: { year: true } }),
  ]);
  const prog = progression(season);
  const grid = gridOf(season);
  // Picture for each team on the grid: that season's car from the register when we have it,
  // otherwise the team's own photo.
  const teamImages = new Map(
    (await prisma.team.findMany({ where: { id: { in: grid.map((t) => t.id) } }, select: { id: true, image: true } })).map((t) => [t.id, t.image]),
  );
  const carByTeam = new Map(season.chassis.map((c) => [c.constructorId, c]));
  const entries = new Map((await prisma.teamSeason.findMany({ where: { year } })).map((t) => [t.teamId, t]));
  const leader = season.driverStandings[0];
  const second = season.driverStandings[1];
  const done = season.races.filter((r) => r.winnerDriverId).length;
  const champ = season.championDriver;
  const margin = leader && second ? leader.points - second.points : null;

  const eventLd = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${year} Formula One World Championship`,
    startDate: season.races[0]?.date.toISOString().slice(0, 10),
    endDate: season.races.at(-1)?.date.toISOString().slice(0, 10),
    sport: "Formula One",
    description: season.headline,
  };

  return (
    <>
      <SetPageContext
        type="SEASON"
        id={String(year)}
        title={`the ${year} season`}
        suggestions={[`How was the ${year} title decided?`, `Who won the most races in ${year}?`, `What rule changes came in for ${year}?`, `Which teams were new in ${year}?`]}
      />
      <PageHero
        eyebrow={`Season ${year}${season.era ? ` · ${season.era.name}` : ""}`}
        title={String(year)}
        subtitle={season.headline}
        crumbs={[{ label: "Seasons", href: "/seasons" }, { label: String(year) }]}
        image={champ?.image ?? null}
        fallback={{ kind: "season", label: String(year) }}
        actions={
          <>
            <BookmarkButton href={`/seasons/${year}`} title={`${year} season`} kind="Season" />
            <ShareButton title={`The ${year} Formula 1 season`} />
          </>
        }
      >
        <SummarizeButton type="SEASON" id={String(year)} />
      </PageHero>

      <FactStrip
        facts={[
          { label: champ ? "Drivers' champion" : "Leader", value: champ ? <Link href={`/drivers/${champ.slug}`} className="link-quiet text-xl sm:text-2xl">{champ.fullName}</Link> : leader ? <Link href={`/drivers/${leader.driver.slug}`} className="link-quiet text-xl sm:text-2xl">{leader.driver.fullName}</Link> : "—" },
          { label: "Constructors' champion", value: season.championConstructor ? <Link href={`/teams/${season.championConstructor.slug}`} className="link-quiet text-xl sm:text-2xl">{season.championConstructor.name}</Link> : year < 1958 ? <span className="text-lg text-mist">Not awarded</span> : "—" },
          { label: "Rounds", value: season.rounds === done ? season.rounds : `${done}/${season.rounds}` },
          { label: "Champion's wins", value: leader?.wins ?? "—" },
          { label: "Title margin", value: margin !== null ? `${formatPoints(margin)} ${margin === 1 ? "pt" : "pts"}` : "—" },
          { label: "Different winners", value: new Set(season.races.map((r) => r.winnerDriverId).filter(Boolean)).size },
        ]}
      />

      <ArticleSection
        article={article ? { ...article, sources: articleSources(article.sources) } : null}
        eyebrow={`The ${year} season`}
      />

      {/* Calendar */}
      <section className="shell py-16" aria-labelledby="calendar">
        <SectionHeading eyebrow="Race by race" title="Calendar & results" id="calendar" />
        <ol className="border-t border-rule">
          {season.races.map((r) => {
            const main = r.results.filter((x) => !x.isSprint);
            const sprint = r.results.filter((x) => x.isSprint);
            return (
              <li key={r.id} className="border-b border-rule">
                <details className="group">
                  <summary className="grid cursor-pointer list-none grid-cols-[2.5rem_1fr_auto] items-center gap-x-4 gap-y-1 py-4 hover:bg-white/[0.03] sm:grid-cols-[3rem_7rem_1fr_1fr_1fr_1.5rem]">
                    <span className="stat-num text-2xl text-mist">{String(r.round).padStart(2, "0")}</span>
                    <span className="hidden text-sm text-mist sm:block">{formatDate(r.date, { year: undefined })}</span>
                    <span>
                      <span className="block font-bold text-white">{r.name}</span>
                      <span className="block text-sm text-mist">{r.circuit.name}{r.hasSprint ? " · Sprint weekend" : ""}</span>
                    </span>
                    <span className="col-start-2 text-sm sm:col-start-auto">
                      <span className="eyebrow mr-2 sm:hidden">Winner</span>
                      {r.winner ? <span className="font-semibold text-white">{r.winner.fullName}</span> : <span className="text-mist">{r.date > new Date() ? "Upcoming" : "—"}</span>}
                      {r.winnerTeam && <span className="block text-mist">{r.winnerTeam.name}</span>}
                    </span>
                    <span className="col-start-2 text-sm text-mist sm:col-start-auto">
                      {r.pole && <span className="block">Pole: {r.pole.fullName}</span>}
                      {r.fastestLap && <span className="block">Fastest lap: {r.fastestLap.fullName}</span>}
                    </span>
                    <span aria-hidden="true" className="row-start-1 text-xl text-signal transition-transform group-open:rotate-45 sm:row-auto">+</span>
                  </summary>
                  {main.length > 0 ? (
                    <div className="pb-6 sm:pl-16">
                      <div className="mb-3 flex flex-wrap gap-4 text-sm">
                        <Link href={`/seasons/${year}/${r.slug}`} className="link">Full race page →</Link>
                        <Link href={`/circuits/${r.circuit.slug}`} className="link">{r.circuit.name} →</Link>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="table-archive text-[0.85rem]">
                          <caption className="sr-only">{r.name} {year} classification</caption>
                          <thead><tr><th scope="col">Pos</th><th scope="col">Driver</th><th scope="col">Team</th><th scope="col" className="text-right">Grid</th><th scope="col" className="text-right">Laps</th><th scope="col">Time / status</th><th scope="col" className="text-right">Pts</th></tr></thead>
                          <tbody>
                            {main.map((x) => (
                              <tr key={x.id}>
                                <td className="font-bold">{x.positionText === "R" ? "DNF" : x.positionText}</td>
                                <td><Link href={`/drivers/${x.driver.slug}`} className="link-quiet">{x.driver.fullName}</Link></td>
                                <td><Link href={`/teams/${x.team.slug}`} className="link-quiet">{x.team.name}{x.engine ? `-${x.engine}` : ""}</Link></td>
                                <td className="text-right tabular-nums">{x.grid || "PL"}</td>
                                <td className="text-right tabular-nums">{x.laps}</td>
                                <td className="text-mist">{x.timeText ?? x.status}</td>
                                <td className="text-right tabular-nums">{x.points ? formatPoints(x.points) : ""}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {sprint.length > 0 && <p className="mt-3 text-sm text-mist">Sprint winner: {sprint[0].driver.fullName}. Full sprint classification on the race page.</p>}
                    </div>
                  ) : (
                    <p className="pb-6 text-sm text-mist sm:pl-16">No results recorded yet for this round.</p>
                  )}
                </details>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Progression */}
      {prog.rows.length > 2 && (
        <section className="shell pb-16" aria-labelledby="progression">
          <SectionHeading eyebrow="The title fight" title="Championship progression" id="progression" />
          <ProgressionChart
            rows={prog.rows}
            series={prog.series}
            title={`Cumulative points, top ${prog.series.length} drivers, ${year}`}
            description={year < 1991 ? "Points scored per round (race + sprint). Seasons before 1991 used dropped-score rules, so official totals can be lower than the running sum." : "Points scored per round, including sprints."}
          />
        </section>
      )}

      {/* Standings */}
      <section className="shell grid gap-12 pb-16 lg:grid-cols-2" aria-label="Final standings">
        <div>
          <SectionHeading eyebrow={done === season.races.length ? "Final" : "Current"} title="Drivers' standings" />
          <SortableTable
            caption={`${year} drivers' championship`}
            columns={[{ label: "Pos", numeric: true }, { label: "Driver" }, { label: "Wins", numeric: true }, { label: "Points", numeric: true }]}
            rows={season.driverStandings.map((s) => ({
              key: s.driverId,
              highlight: s.position === 1,
              sort: [s.position ?? 999, s.driver.familyName, s.wins, s.points],
              cells: [s.positionText, <Link key="d" href={`/drivers/${s.driver.slug}`} className="link-quiet font-semibold">{s.driver.fullName}</Link>, s.wins, formatPoints(s.points)],
            }))}
          />
        </div>
        <div>
          <SectionHeading eyebrow={done === season.races.length ? "Final" : "Current"} title="Constructors' standings" />
          {season.constructorStandings.length ? (
            <SortableTable
              caption={`${year} constructors' championship`}
              columns={[{ label: "Pos", numeric: true }, { label: "Constructor" }, { label: "Wins", numeric: true }, { label: "Points", numeric: true }]}
              rows={season.constructorStandings.map((s) => ({
                key: s.constructorId,
                highlight: s.position === 1,
                sort: [s.position ?? 999, s.team.name, s.wins, s.points],
                cells: [
                  s.positionText,
                  <Link key="c" href={`/teams/${s.team.slug}`} className="link-quiet inline-flex items-center gap-2 font-semibold">
                    <span className="h-3 w-1.5" style={{ background: s.team.color }} aria-hidden="true" />
                    {s.team.name}
                  </Link>,
                  s.wins,
                  formatPoints(s.points),
                ],
              }))}
            />
          ) : (
            <p className="text-mist">The Constructors&apos; Championship was first awarded in 1958.</p>
          )}
        </div>
      </section>

      {/* On the grid */}
      <section className="border-t border-rule bg-carbon py-16" aria-labelledby="grid">
        <div className="shell">
          <SectionHeading eyebrow={`${grid.length} constructors`} title="On the grid" id="grid" />
          {season.chassis.length > 0 && (
            <ul className="mb-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {season.chassis.map((c) => (
                <li key={c.id} className="border border-rule">
                  <ArchiveImage image={c.image} fallback={{ kind: "team", name: c.name, color: c.team.color }} className="aspect-[16/9]" credit="overlay" />
                  <div className="p-4">
                    <p className="eyebrow">{c.team.name} · {c.year}</p>
                    <p className="mt-1 font-display text-xl font-bold">{c.name}</p>
                    <p className="mt-1 text-sm text-mist">{[c.engine && `${c.engine.manufacturer} ${c.engine.configuration}`, c.designer && `Designer: ${c.designer}`].filter(Boolean).join(" · ")}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <ul className="grid gap-px bg-rule sm:grid-cols-2 lg:grid-cols-3">
            {grid.map((t) => (
              <li key={t.id} className="bg-carbon p-5">
                <Link href={`/teams/${t.slug}`} className="card-zoom group mb-4 block" tabIndex={-1} aria-hidden="true">
                  <div className="relative aspect-[16/9] overflow-hidden">
                    <ArchiveImage
                      image={carByTeam.get(t.id)?.image ?? teamImages.get(t.id) ?? null}
                      fallback={{ kind: "team", name: t.name, color: t.color }}
                      className="h-full w-full"
                      sizes="(min-width:1024px) 30vw, (min-width:640px) 45vw, 100vw"
                    />
                    <span className="absolute inset-x-0 top-0 h-1" style={{ background: t.color }} />
                    {carByTeam.get(t.id) && (
                      <span className="absolute bottom-0 left-0 bg-black/70 px-2 py-1 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-white">
                        {carByTeam.get(t.id)!.name}
                      </span>
                    )}
                  </div>
                </Link>
                <Link href={`/teams/${t.slug}`} className="group flex items-center gap-3">
                  <span className="h-8 w-1.5" style={{ background: t.color }} aria-hidden="true" />
                  <span className="font-display text-lg font-bold group-hover:text-signal-bright">{t.name}</span>
                </Link>
                {(() => {
                  const e = entries.get(t.id);
                  const chassis = e?.chassis.length ? e.chassis : [];
                  const engines = e?.engines.length ? e.engines : [...t.engines];
                  return (
                    <dl className="mt-2 space-y-0.5 pl-[18px] text-xs">
                      {chassis.length > 0 && (
                        <div className="flex gap-2"><dt className="uppercase tracking-[0.12em] text-mist">Chassis</dt><dd className="font-semibold text-white">{chassis.join(", ")}</dd></div>
                      )}
                      {engines.length > 0 && (
                        <div className="flex gap-2"><dt className="uppercase tracking-[0.12em] text-mist">Engine</dt><dd className="text-white/85">{engines.join(", ")}</dd></div>
                      )}
                    </dl>
                  );
                })()}
                <ul className="mt-3 space-y-1 pl-[18px] text-sm">
                  {[...t.drivers.values()].sort((a, b) => b.starts - a.starts).map((d) => (
                    <li key={d.slug}>
                      <Link href={`/drivers/${d.slug}`} className="link-quiet text-white/90">{d.name}</Link>
                      <span className="text-mist"> · {d.starts} {d.starts === 1 ? "race" : "races"}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Regulations */}
      <section className="shell grid-12 gap-y-6 py-16" aria-labelledby="regs">
        <div className="col-span-4 sm:col-span-8 lg:col-span-4">
          <p className="eyebrow-accent">Rulebook</p>
          <h2 id="regs" className="mt-2 text-display-md">Regulation changes</h2>
          {season.era && <p className="mt-3 text-mist">Part of the <Link href={`/eras/${season.era.slug}`} className="link">{season.era.name}</Link> era.</p>}
        </div>
        <div className="col-span-4 sm:col-span-8 lg:col-span-7 lg:col-start-6">
          {season.regulationChanges.length ? (
            <ul className="divide-y divide-rule border-y border-rule">
              {season.regulationChanges.map((r) => <li key={r} className="py-3 text-lg text-white/90">{r}</li>)}
            </ul>
          ) : (
            <p className="text-mist">No major regulation change is recorded for {year} in the archive.</p>
          )}
        </div>
      </section>

      {/* Prev / next */}
      <nav aria-label="Season navigation" className="border-t border-rule">
        <div className="shell grid grid-cols-2">
          {prev ? (
            <Link href={`/seasons/${prev.year}`} className="group border-r border-rule py-10 pr-4">
              <span className="eyebrow">← Previous season</span>
              <span className="stat-num mt-2 block text-5xl group-hover:text-signal-bright">{prev.year}</span>
            </Link>
          ) : <span />}
          {next ? (
            <Link href={`/seasons/${next.year}`} className="group py-10 pl-4 text-right">
              <span className="eyebrow">Next season →</span>
              <span className="stat-num mt-2 block text-5xl group-hover:text-signal-bright">{next.year}</span>
            </Link>
          ) : <span />}
        </div>
      </nav>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventLd) }} />
    </>
  );
}
