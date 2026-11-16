import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getDriver, notableRaces, teammateHeadToHead, teamsOf } from "@/lib/driverData";
import { articleSources, getArticle } from "@/lib/queries";
import { ageAt, formatDate, formatPoints, isoFromNationality } from "@/lib/text";
import { ArticleSection, FactStrip, NationalityBadge, PageHero, SectionHeading } from "@/components/PageBlocks";
import { BookmarkButton, ShareButton, SummarizeButton } from "@/components/PageTools";
import { SortableTable } from "@/components/SortableTable";
import { SeasonBars } from "@/components/charts/Charts";
import { SetPageContext } from "@/components/chat/pageContext";

export const revalidate = 3600;

export async function generateStaticParams() {
  try {
    return (await prisma.driver.findMany({ where: { titles: { gt: 0 } }, select: { slug: true } })).map((d) => ({ slug: d.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const d = await getDriver((await params).slug);
  if (!d) return { title: "Driver not found" };
  const desc = `${d.fullName} (${d.nationality}): ${d.starts} starts, ${d.wins} wins, ${d.poles} poles, ${d.titles} World Championship${d.titles === 1 ? "" : "s"}. Biography, results and teammate head-to-heads.`;
  return { title: d.fullName, description: desc, openGraph: { title: `${d.fullName} — driver profile`, description: desc, type: "profile" }, alternates: { canonical: `/drivers/${d.slug}` } };
}

export default async function DriverPage({ params }: { params: Promise<{ slug: string }> }) {
  const driver = await getDriver((await params).slug);
  if (!driver) notFound();
  const [article, teams, h2h, notable, seasonResults] = await Promise.all([
    getArticle("DRIVER", driver.id),
    teamsOf(driver.id),
    teammateHeadToHead(driver.id),
    notableRaces(driver.id),
    prisma.$queryRaw<{ year: number; starts: number; wins: number; podiums: number; best: number | null; teams: string[] }[]>`
      SELECT ra.year, COUNT(DISTINCT r."raceId")::int AS starts, COUNT(*) FILTER (WHERE r.position = 1)::int AS wins,
             COUNT(*) FILTER (WHERE r.position <= 3)::int AS podiums, MIN(r.position)::int AS best, array_agg(DISTINCT c.name) AS teams
      FROM "Result" r JOIN "Race" ra ON ra.id = r."raceId" JOIN "Constructor" c ON c.id = r."constructorId"
      WHERE r."driverId" = ${driver.id} AND r."isSprint" = false GROUP BY ra.year ORDER BY ra.year`,
  ]);
  const standings = new Map(driver.standings.map((s) => [s.year, s]));
  const titleYears = driver.standings.filter((s) => s.position === 1).map((s) => s.year);
  const iso = isoFromNationality(driver.nationality);
  const age = driver.dateOfBirth ? ageAt(driver.dateOfBirth, driver.dateOfDeath ?? new Date()) : null;

  const personLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: driver.fullName,
    nationality: driver.nationality,
    birthDate: driver.dateOfBirth?.toISOString().slice(0, 10),
    deathDate: driver.dateOfDeath?.toISOString().slice(0, 10),
    jobTitle: "Racing driver",
    sameAs: driver.url ?? undefined,
    image: driver.image?.path,
  };

  return (
    <>
      <SetPageContext
        type="DRIVER"
        id={driver.id}
        title={driver.fullName}
        suggestions={[
          `Which teams did ${driver.fullName} drive for?`,
          `What were ${driver.familyName}'s best seasons?`,
          `How did ${driver.familyName} compare with their teammates?`,
          `What was ${driver.familyName}'s first win?`,
        ]}
      />
      <PageHero
        eyebrow={`Driver profile${titleYears.length ? ` · ${titleYears.length}× World Champion` : ""}`}
        title={driver.fullName}
        subtitle={
          <span className="flex flex-wrap gap-x-5 gap-y-1 text-base sm:text-lg">
            <NationalityBadge iso={iso} label={driver.nationality} />
            {driver.dateOfBirth && <span>Born {formatDate(driver.dateOfBirth)}{!driver.dateOfDeath && age !== null ? ` (age ${age})` : ""}</span>}
            {driver.dateOfDeath && <span>Died {formatDate(driver.dateOfDeath)}</span>}
            {driver.firstYear && <span>{driver.firstYear}–{driver.lastYear}</span>}
            {driver.numbers.length > 0 && <span>Car {driver.numbers.length > 6 ? `numbers incl. ${driver.permanentNumber ?? driver.numbers[0]}` : `No. ${driver.numbers.join(", ")}`}</span>}
          </span>
        }
        crumbs={[{ label: "Drivers", href: "/drivers" }, { label: driver.fullName }]}
        image={driver.image}
        fallback={{ kind: "initials", name: driver.fullName }}
        actions={<><BookmarkButton href={`/drivers/${driver.slug}`} title={driver.fullName} kind="Driver" /><ShareButton title={`${driver.fullName} — GRID ARCHIVE`} /><Link href={`/drivers/compare?d=${driver.slug}`} className="btn-ghost">Compare</Link></>}
      >
        <SummarizeButton type="DRIVER" id={driver.id} />
      </PageHero>

      <FactStrip
        facts={[
          { label: "Starts", value: driver.starts },
          { label: "Wins", value: driver.wins },
          { label: "Poles", value: driver.poles },
          { label: "Podiums", value: driver.podiums },
          { label: "Points", value: formatPoints(driver.points) },
          { label: "Titles", value: driver.titles },
        ]}
      />
      <p className="shell py-2 text-right text-xs text-mist">Fastest laps: {driver.fastestLaps} (fastest-lap data is complete from 2004).</p>

      <ArticleSection article={article ? { ...article, sources: articleSources(article.sources) } : null} eyebrow="Biography" />

      {driver.standings.length > 0 && (
        <section className="shell py-16" aria-labelledby="seasons">
          <SectionHeading eyebrow="Career" title="Season by season" id="seasons" />
          <div className="mb-8">
            <SeasonBars
              title={`${driver.fullName}: championship points per season`}
              rows={driver.standings.map((s) => ({ year: s.year, points: s.points, position: s.positionText }))}
            />
          </div>
          <SortableTable
            caption={`${driver.fullName} results by season`}
            columns={[{ label: "Year", numeric: true }, { label: "Team" }, { label: "Starts", numeric: true }, { label: "Wins", numeric: true }, { label: "Podiums", numeric: true }, { label: "Best", numeric: true }, { label: "Points", numeric: true }, { label: "Pos", numeric: true }]}
            initialDir="asc"
            rows={seasonResults.map((s) => {
              const st = standings.get(s.year);
              return {
                key: String(s.year),
                highlight: st?.position === 1,
                sort: [s.year, s.teams.join(), s.starts, s.wins, s.podiums, s.best, st?.points ?? 0, st?.position ?? 999],
                cells: [<Link key="y" href={`/seasons/${s.year}`} className="link-quiet font-bold">{s.year}</Link>, s.teams.join(", "), s.starts, s.wins, s.podiums, s.best ?? "—", st ? formatPoints(st.points) : "—", st?.positionText ?? "—"],
              };
            })}
          />
        </section>
      )}

      <section className="border-t border-rule bg-carbon py-16" aria-labelledby="teams">
        <div className="shell">
          <SectionHeading eyebrow={`${teams.length} constructors`} title="Teams driven for" id="teams" />
          <ul className="grid gap-px bg-rule sm:grid-cols-2 lg:grid-cols-4">
            {teams.map((t) => (
              <li key={t.slug} className="bg-carbon">
                <Link href={`/teams/${t.slug}`} className="group block p-5">
                  <span className="block h-1 w-12" style={{ background: t.color }} aria-hidden="true" />
                  <span className="mt-3 block font-display text-xl font-bold group-hover:text-signal-bright">{t.name}</span>
                  <span className="mt-1 block text-sm text-mist">{t.first === t.last ? t.first : `${t.first}–${t.last}`} · {t.starts} starts{t.wins ? ` · ${t.wins} wins` : ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {h2h.length > 0 && (
        <section className="shell py-16" aria-labelledby="h2h">
          <SectionHeading eyebrow="Same car, same race" title="Teammate head-to-head" id="h2h" />
          <SortableTable
            caption={`${driver.fullName} versus teammates`}
            columns={[{ label: "Teammate" }, { label: "Years" }, { label: "Races", numeric: true }, { label: "Finished ahead", numeric: true }, { label: "Qualified ahead", numeric: true }]}
            initialSort={2}
            initialDir="desc"
            rows={h2h.map((t) => ({
              key: t.slug,
              sort: [t.name, t.years, t.races, t.raceAhead / t.races, t.qualiAhead / Math.max(1, t.qualiAhead + t.qualiBehind)],
              cells: [
                <Link key="t" href={`/drivers/${t.slug}`} className="link-quiet font-semibold">{t.name}</Link>,
                t.years,
                t.races,
                <span key="r" className={t.raceAhead > t.raceBehind ? "font-bold text-white" : "text-mist"}>{t.raceAhead}–{t.raceBehind}</span>,
                <span key="q" className={t.qualiAhead > t.qualiBehind ? "font-bold text-white" : "text-mist"}>{t.qualiAhead}–{t.qualiBehind}</span>,
              ],
            }))}
          />
          <p className="mt-3 text-xs text-mist">Race: classified ahead (including retirements order). Qualifying: higher starting grid position. Shared drives and non-starts excluded.</p>
        </section>
      )}

      <section className="border-t border-rule py-16" aria-labelledby="notable">
        <div className="shell">
          <SectionHeading eyebrow="Milestones" title="Notable races" id="notable" />
          <ul className="grid gap-px bg-rule sm:grid-cols-3">
            {notable.first && (
              <li className="bg-ink p-5">
                <p className="eyebrow">First start</p>
                <Link href={`/seasons/${notable.first.race.year}/${notable.first.race.slug}`} className="mt-2 block font-display text-xl font-bold hover:text-signal-bright">{notable.first.race.year} {notable.first.race.name}</Link>
                <p className="text-sm text-mist">{notable.first.team.name} · finished {notable.first.positionText}</p>
              </li>
            )}
            {notable.podiumFirst && (
              <li className="bg-ink p-5">
                <p className="eyebrow">First podium</p>
                <Link href={`/seasons/${notable.podiumFirst.race.year}/${notable.podiumFirst.race.slug}`} className="mt-2 block font-display text-xl font-bold hover:text-signal-bright">{notable.podiumFirst.race.year} {notable.podiumFirst.race.name}</Link>
                <p className="text-sm text-mist">Finished P{notable.podiumFirst.position}</p>
              </li>
            )}
            {notable.wins[0] && (
              <li className="bg-ink p-5">
                <p className="eyebrow">First win</p>
                <Link href={`/seasons/${notable.wins[0].year}/${notable.wins[0].slug}`} className="mt-2 block font-display text-xl font-bold hover:text-signal-bright">{notable.wins[0].year} {notable.wins[0].name}</Link>
                <p className="text-sm text-mist">{notable.wins[0].winnerTeam?.name} · {notable.wins[0].circuit.name}</p>
              </li>
            )}
          </ul>
          {notable.wins.length > 1 && (
            <details className="mt-6">
              <summary className="cursor-pointer text-sm font-bold uppercase tracking-[0.12em] text-white hover:text-signal-bright">All {notable.wins.length} Grand Prix wins</summary>
              <ol className="mt-4 grid gap-x-8 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {notable.wins.map((w, i) => (
                  <li key={w.id} className="border-b border-rule/60 py-2">
                    <span className="mr-3 tabular-nums text-mist">{i + 1}.</span>
                    <Link href={`/seasons/${w.year}/${w.slug}`} className="link-quiet">{w.year} {w.name}</Link>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personLd) }} />
    </>
  );
}
