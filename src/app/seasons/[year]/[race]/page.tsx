import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { formatDate, formatPoints } from "@/lib/text";
import { FactStrip, PageHero, SectionHeading } from "@/components/PageBlocks";
import { BookmarkButton, ShareButton } from "@/components/PageTools";
import { SetPageContext } from "@/components/chat/pageContext";

export const revalidate = 3600;

// Rendered on first request, then cached and revalidated hourly (ISR).
export async function generateStaticParams() {
  return [];
}

const getRace = cache(async (year: number, key: string) => {
  const where = /^\d+$/.test(key) ? { year_round: { year, round: Number(key) } } : { year_slug: { year, slug: key } };
  return prisma.race.findUnique({
    where,
    include: {
      circuit: { include: { image: true } },
      winner: true, winnerTeam: true, pole: true, fastestLap: true,
      results: { orderBy: [{ isSprint: "asc" }, { positionOrder: "asc" }], include: { driver: true, team: true } },
      qualifying: { orderBy: { position: "asc" }, include: { driver: true, team: true } },
    },
  });
});

export async function generateMetadata({ params }: { params: Promise<{ year: string; race: string }> }): Promise<Metadata> {
  const { year, race } = await params;
  const r = await getRace(Number(year), race);
  if (!r) return { title: "Race not found" };
  return {
    title: `${r.year} ${r.name}`,
    description: `${r.year} ${r.name} at ${r.circuit.name}${r.winner ? `, won by ${r.winner.fullName}` : ""}. Full classification, qualifying and fastest lap.`,
    alternates: { canonical: `/seasons/${r.year}/${r.slug}` },
  };
}

export default async function RacePage({ params }: { params: Promise<{ year: string; race: string }> }) {
  const { year, race: key } = await params;
  const race = await getRace(Number(year), key);
  if (!race) notFound();
  const [prev, next] = await Promise.all([
    prisma.race.findUnique({ where: { year_round: { year: race.year, round: race.round - 1 } }, select: { slug: true, name: true } }),
    prisma.race.findUnique({ where: { year_round: { year: race.year, round: race.round + 1 } }, select: { slug: true, name: true } }),
  ]);
  const main = race.results.filter((r) => !r.isSprint);
  const sprint = race.results.filter((r) => r.isSprint);
  const winnerRow = main.find((r) => r.position === 1);

  const table = (rows: typeof main, caption: string) => (
    <div className="overflow-x-auto">
      <table className="table-archive">
        <caption className="sr-only">{caption}</caption>
        <thead><tr><th scope="col">Pos</th><th scope="col">No.</th><th scope="col">Driver</th><th scope="col">Constructor</th><th scope="col" className="text-right">Grid</th><th scope="col" className="text-right">Laps</th><th scope="col">Time / status</th><th scope="col">Fastest lap</th><th scope="col" className="text-right">Pts</th></tr></thead>
        <tbody>
          {rows.map((x) => (
            <tr key={x.id} className={x.position === 1 ? "bg-signal/10" : undefined}>
              <td className="font-bold">{x.positionText === "R" ? "DNF" : x.positionText}</td>
              <td className="tabular-nums text-mist">{x.number}</td>
              <td><Link href={`/drivers/${x.driver.slug}`} className="link-quiet font-semibold">{x.driver.fullName}</Link></td>
              <td><Link href={`/teams/${x.team.slug}`} className="link-quiet">{x.team.name}{x.engine ? `-${x.engine}` : ""}</Link></td>
              <td className="text-right tabular-nums">{x.grid || "PL"}</td>
              <td className="text-right tabular-nums">{x.laps}</td>
              <td className="text-mist">{x.timeText ?? x.status}</td>
              <td className={`tabular-nums ${x.fastestLapRank === 1 ? "font-bold text-signal-bright" : "text-mist"}`}>{x.fastestLapTime ?? ""}</td>
              <td className="text-right tabular-nums">{x.points ? formatPoints(x.points) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <SetPageContext type="RACE" id={race.id} title={`the ${race.year} ${race.name}`} suggestions={[`How did the ${race.year} ${race.name} unfold?`, `Who has won the most at ${race.circuit.name}?`]} />
      <PageHero
        eyebrow={`Round ${race.round} · ${formatDate(race.date)}`}
        title={`${race.year} ${race.name}`}
        subtitle={<>{race.circuit.name}, {race.circuit.locality}, {race.circuit.country}</>}
        crumbs={[{ label: "Seasons", href: "/seasons" }, { label: String(race.year), href: `/seasons/${race.year}` }, { label: race.name }]}
        image={race.circuit.image}
        fallback={{ kind: "track", name: race.circuit.name }}
        actions={<><BookmarkButton href={`/seasons/${race.year}/${race.slug}`} title={`${race.year} ${race.name}`} kind="Race" /><ShareButton title={`${race.year} ${race.name}`} /></>}
      />
      <FactStrip
        facts={[
          { label: "Winner", value: race.winner ? <Link href={`/drivers/${race.winner.slug}`} className="link-quiet text-xl">{race.winner.fullName}</Link> : "—" },
          { label: "Constructor", value: race.winnerTeam ? <Link href={`/teams/${race.winnerTeam.slug}`} className="link-quiet text-xl">{race.winnerTeam.name}</Link> : "—" },
          { label: "Pole position", value: race.pole ? <Link href={`/drivers/${race.pole.slug}`} className="link-quiet text-xl">{race.pole.fullName}</Link> : "—" },
          { label: "Fastest lap", value: race.fastestLap ? <span className="text-xl">{race.fastestLap.fullName}</span> : <span className="text-base text-mist">Not recorded</span> },
          { label: "Laps", value: winnerRow?.laps ?? "—" },
          { label: "Winning time", value: <span className="text-xl">{winnerRow?.timeText ?? "—"}</span> },
        ]}
      />
      <section className="shell py-14" aria-labelledby="classification">
        <SectionHeading eyebrow="Race" title="Classification" id="classification" />
        {main.length ? table(main, `${race.year} ${race.name} classification`) : <p className="text-mist">This race has not been run yet, or results are not yet available.</p>}
      </section>
      {sprint.length > 0 && (
        <section className="shell pb-14" aria-labelledby="sprint">
          <SectionHeading eyebrow="Saturday" title="Sprint" id="sprint" />
          {table(sprint, `${race.year} ${race.name} sprint classification`)}
        </section>
      )}
      {race.qualifying.length > 0 && (
        <section className="shell pb-14" aria-labelledby="quali">
          <SectionHeading eyebrow="Grid" title="Qualifying" id="quali" />
          <div className="overflow-x-auto">
            <table className="table-archive">
              <thead><tr><th scope="col">Pos</th><th scope="col">Driver</th><th scope="col">Constructor</th><th scope="col">Q1</th><th scope="col">Q2</th><th scope="col">Q3</th></tr></thead>
              <tbody>
                {race.qualifying.map((q) => (
                  <tr key={q.id}>
                    <td className="font-bold">{q.position}</td>
                    <td><Link href={`/drivers/${q.driver.slug}`} className="link-quiet">{q.driver.fullName}</Link></td>
                    <td>{q.team.name}</td>
                    <td className="tabular-nums text-mist">{q.q1}</td>
                    <td className="tabular-nums text-mist">{q.q2}</td>
                    <td className="tabular-nums">{q.q3}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <nav aria-label="Race navigation" className="border-t border-rule">
        <div className="shell grid grid-cols-2">
          {prev ? <Link href={`/seasons/${race.year}/${prev.slug}`} className="group border-r border-rule py-8 pr-4"><span className="eyebrow">← Previous round</span><span className="mt-1 block font-display text-xl font-bold group-hover:text-signal-bright">{prev.name}</span></Link> : <Link href={`/seasons/${race.year}`} className="py-8 eyebrow">← {race.year} season</Link>}
          {next ? <Link href={`/seasons/${race.year}/${next.slug}`} className="group py-8 pl-4 text-right"><span className="eyebrow">Next round →</span><span className="mt-1 block font-display text-xl font-bold group-hover:text-signal-bright">{next.name}</span></Link> : <Link href={`/seasons/${race.year}`} className="py-8 text-right eyebrow">{race.year} season →</Link>}
        </div>
      </nav>
    </>
  );
}
