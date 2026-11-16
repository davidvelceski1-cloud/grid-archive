import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDate, formatPoints, preciseAge } from "@/lib/text";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SectionHeading } from "@/components/PageBlocks";
import { SortableTable } from "@/components/SortableTable";
import { ScrollToHash } from "@/components/ScrollToHash";

export const revalidate = 3600;
export const metadata: Metadata = { title: "Records", description: "Formula 1 records hall: most wins, titles, poles and podiums, youngest and oldest winners, and dominant seasons." };

interface DriverAgg { slug: string; fullName: string; nationality: string | null; starts: number; wins: number; poles: number; podiums: number; points: number }

export default async function RecordsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const eras = await prisma.era.findMany({ orderBy: { order: "asc" } });
  const from = Number(sp.from) || 1950;
  const to = Number(sp.to) || 2100;
  const filtered = Boolean(sp.from || sp.to);

  const [drivers, teams, youngest, oldest, seasonWins, youngestChamps] = await Promise.all([
    prisma.$queryRaw<DriverAgg[]>`
      WITH res AS (
        SELECT r.*, ra.year FROM "Result" r JOIN "Race" ra ON ra.id = r."raceId"
        WHERE ra.year BETWEEN ${from} AND ${to} AND r."isSprint" = false
      )
      SELECT d.slug, d."fullName", d.nationality,
        COUNT(DISTINCT res."raceId") FILTER (WHERE res."positionText" NOT IN ('F','W','EX'))::int AS starts,
        COUNT(*) FILTER (WHERE res.position = 1)::int AS wins,
        (SELECT COUNT(*)::int FROM "Race" ra2 WHERE ra2."poleDriverId" = d.id AND ra2.year BETWEEN ${from} AND ${to}) AS poles,
        COUNT(*) FILTER (WHERE res.position <= 3)::int AS podiums,
        COALESCE(SUM(res.points), 0)::float AS points
      FROM res JOIN "Driver" d ON d.id = res."driverId"
      GROUP BY d.id, d.slug, d."fullName", d.nationality
      HAVING COUNT(*) FILTER (WHERE res.position <= 3) > 0
      ORDER BY wins DESC, podiums DESC LIMIT 100`,
    prisma.$queryRaw<{ slug: string; name: string; color: string; entries: number; wins: number; podiums: number; titles: number }[]>`
      SELECT c.slug, c.name, c.color, COUNT(DISTINCT r."raceId")::int AS entries,
        COUNT(*) FILTER (WHERE r.position = 1)::int AS wins, COUNT(*) FILTER (WHERE r.position <= 3)::int AS podiums,
        (SELECT COUNT(*)::int FROM "Season" s WHERE s."championConstructorId" = c.id AND s.year BETWEEN ${from} AND ${to}) AS titles
      FROM "Result" r JOIN "Race" ra ON ra.id = r."raceId" JOIN "Constructor" c ON c.id = r."constructorId"
      WHERE ra.year BETWEEN ${from} AND ${to} AND r."isSprint" = false
      GROUP BY c.id, c.slug, c.name, c.color HAVING COUNT(*) FILTER (WHERE r.position <= 3) > 0
      ORDER BY wins DESC LIMIT 50`,
    prisma.$queryRaw<{ slug: string; fullName: string; dob: Date; date: Date; race: string; year: number; raceSlug: string }[]>`
      SELECT d.slug, d."fullName", d."dateOfBirth" AS dob, r.date, r.name AS race, r.year, r.slug AS "raceSlug"
      FROM "Race" r JOIN "Driver" d ON d.id = r."winnerDriverId"
      WHERE d."dateOfBirth" IS NOT NULL AND r.year BETWEEN ${from} AND ${to}
      ORDER BY (r.date - d."dateOfBirth") ASC LIMIT 10`,
    prisma.$queryRaw<{ slug: string; fullName: string; dob: Date; date: Date; race: string; year: number; raceSlug: string }[]>`
      SELECT d.slug, d."fullName", d."dateOfBirth" AS dob, r.date, r.name AS race, r.year, r.slug AS "raceSlug"
      FROM "Race" r JOIN "Driver" d ON d.id = r."winnerDriverId"
      WHERE d."dateOfBirth" IS NOT NULL AND r.year BETWEEN ${from} AND ${to}
      ORDER BY (r.date - d."dateOfBirth") DESC LIMIT 10`,
    prisma.$queryRaw<{ slug: string; fullName: string; year: number; wins: number; races: number }[]>`
      SELECT d.slug, d."fullName", s.year, s.wins, se.rounds AS races
      FROM "DriverStanding" s JOIN "Driver" d ON d.id = s."driverId" JOIN "Season" se ON se.year = s.year
      WHERE s.year BETWEEN ${from} AND ${to} ORDER BY s.wins DESC, (s.wins::float / NULLIF(se.rounds,0)) DESC LIMIT 10`,
    prisma.$queryRaw<{ slug: string; fullName: string; year: number; dob: Date; last: Date }[]>`
      SELECT d.slug, d."fullName", s.year, d."dateOfBirth" AS dob, MAX(r.date) AS last
      FROM "Season" s JOIN "Driver" d ON d.id = s."championDriverId" JOIN "Race" r ON r.year = s.year
      WHERE d."dateOfBirth" IS NOT NULL AND s.year BETWEEN ${from} AND ${to}
      GROUP BY d.slug, d."fullName", s.year, d."dateOfBirth" ORDER BY (MAX(r.date) - d."dateOfBirth") ASC LIMIT 10`,
  ]);

  const ageList = (rows: typeof youngest) => (
    <ol className="divide-y divide-rule border-y border-rule">
      {rows.map((r, i) => (
        <li key={`${r.slug}-${r.year}-${r.race}`} className="flex flex-wrap items-baseline gap-x-4 py-3">
          <span className="w-5 tabular-nums text-mist">{i + 1}</span>
          <Link href={`/drivers/${r.slug}`} className="link-quiet font-semibold">{r.fullName}</Link>
          <span className="ml-auto text-sm tabular-nums">{preciseAge(new Date(r.dob), new Date(r.date)).label}</span>
          <Link href={`/seasons/${r.year}/${r.raceSlug}`} className="w-full pl-9 text-xs text-mist hover:text-white">{r.year} {r.race} · {formatDate(r.date)}</Link>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="shell pb-20 pt-10">
      <Breadcrumbs items={[{ label: "Records" }]} />
      <p className="eyebrow-accent mt-10">Records hall</p>
      <h1 className="mt-3 text-display-xl">Records</h1>
      <p className="mt-5 max-w-2xl text-lg text-white/80">Leaderboards computed directly from the results database. Filter by era to compare like with like.</p>
      <ScrollToHash />
      <nav aria-label="Filter by era" className="mt-8 flex flex-wrap gap-2">
        {/* Each filter jumps straight to the leaderboard it changes. Plain links on purpose:
            Next.js client navigation ignored links that change both the query and the #anchor
            on the same page, so the browser loads the filtered page and scrolls to the anchor. */}
        <a href="/records#leaderboard" className="chip" aria-pressed={!filtered}>All time</a>
        {eras.map((e) => (
          <a key={e.slug} href={`/records?from=${e.startYear}&to=${e.endYear ?? 2100}#leaderboard`} className="chip" aria-pressed={filtered && from === e.startYear}>
            {e.name}
          </a>
        ))}
      </nav>

      <section id="leaderboard" className="mt-14 scroll-mt-24" aria-labelledby="drivers">
        <SectionHeading eyebrow={filtered ? `${from}–${to === 2100 ? "today" : to}` : "All time"} title="Drivers" id="drivers" />
        <SortableTable
          caption="Driver records"
          columns={[{ label: "#", numeric: true }, { label: "Driver" }, { label: "Nationality" }, { label: "Starts", numeric: true }, { label: "Wins", numeric: true }, { label: "Poles", numeric: true }, { label: "Podiums", numeric: true }, { label: "Win %", numeric: true }, { label: "Points", numeric: true }]}
          initialSort={4}
          initialDir="desc"
          rows={drivers.map((d, i) => ({
            key: d.slug,
            sort: [i + 1, d.fullName, d.nationality, d.starts, d.wins, d.poles, d.podiums, d.starts ? d.wins / d.starts : 0, d.points],
            cells: [i + 1, <Link key="d" href={`/drivers/${d.slug}`} className="link-quiet font-semibold">{d.fullName}</Link>, d.nationality, d.starts, d.wins, d.poles, d.podiums, d.starts ? `${((d.wins / d.starts) * 100).toFixed(1)}` : "—", formatPoints(Math.round(d.points * 10) / 10)],
          }))}
        />
      </section>

      <section className="mt-16" aria-labelledby="teams">
        <SectionHeading eyebrow="Constructors" title="Teams" id="teams" />
        <SortableTable
          caption="Team records"
          columns={[{ label: "Team" }, { label: "Races", numeric: true }, { label: "Wins", numeric: true }, { label: "Podiums", numeric: true }, { label: "Constructors' titles", numeric: true }]}
          initialSort={2}
          initialDir="desc"
          rows={teams.map((t) => ({
            key: t.slug,
            sort: [t.name, t.entries, t.wins, t.podiums, t.titles],
            cells: [<Link key="t" href={`/teams/${t.slug}`} className="link-quiet inline-flex items-center gap-2 font-semibold"><span className="h-3 w-1.5" style={{ background: t.color }} aria-hidden="true" />{t.name}</Link>, t.entries, t.wins, t.podiums, t.titles],
          }))}
        />
      </section>

      <div className="mt-16 grid gap-12 lg:grid-cols-2">
        <section aria-labelledby="youngest"><SectionHeading eyebrow="Age at victory" title="Youngest winners" id="youngest" />{ageList(youngest)}</section>
        <section aria-labelledby="oldest"><SectionHeading eyebrow="Age at victory" title="Oldest winners" id="oldest" />{ageList(oldest)}</section>
        <section aria-labelledby="champs">
          <SectionHeading eyebrow="Age at final race" title="Youngest champions" id="champs" />
          <ol className="divide-y divide-rule border-y border-rule">
            {youngestChamps.map((c, i) => (
              <li key={c.year} className="flex items-baseline gap-4 py-3">
                <span className="w-5 tabular-nums text-mist">{i + 1}</span>
                <Link href={`/drivers/${c.slug}`} className="link-quiet font-semibold">{c.fullName}</Link>
                <Link href={`/seasons/${c.year}`} className="text-sm text-mist hover:text-white">{c.year}</Link>
                <span className="ml-auto text-sm tabular-nums">{preciseAge(new Date(c.dob), new Date(c.last)).label}</span>
              </li>
            ))}
          </ol>
        </section>
        <section aria-labelledby="dominant">
          <SectionHeading eyebrow="Single season" title="Most wins in a season" id="dominant" />
          <ol className="divide-y divide-rule border-y border-rule">
            {seasonWins.map((s, i) => (
              <li key={`${s.slug}-${s.year}`} className="flex items-baseline gap-4 py-3">
                <span className="w-5 tabular-nums text-mist">{i + 1}</span>
                <Link href={`/drivers/${s.slug}`} className="link-quiet font-semibold">{s.fullName}</Link>
                <Link href={`/seasons/${s.year}`} className="text-sm text-mist hover:text-white">{s.year}</Link>
                <span className="ml-auto stat-num text-xl">{s.wins}<span className="text-sm text-mist">/{s.races}</span></span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
