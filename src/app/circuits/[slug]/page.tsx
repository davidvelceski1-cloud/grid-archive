import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { articleSources, getArticle } from "@/lib/queries";
import { formatDate } from "@/lib/text";
import { ArticleSection, FactStrip, PageHero, SectionHeading } from "@/components/PageBlocks";
import { BookmarkButton, ShareButton, SummarizeButton } from "@/components/PageTools";
import { SortableTable } from "@/components/SortableTable";
import { ArchiveImage } from "@/components/ArchiveImage";
import { CircuitMapLoader } from "@/components/map/CircuitMapLoader";
import { SetPageContext } from "@/components/chat/pageContext";

export const revalidate = 3600;

const getCircuit = cache((slug: string) =>
  prisma.circuit.findUnique({ where: { slug }, include: { image: true, trackMap: true, layouts: { orderBy: { fromYear: "asc" } } } }),
);

export async function generateStaticParams() {
  try {
    return (await prisma.circuit.findMany({ where: { raceCount: { gt: 0 } }, select: { slug: true } })).map((c) => ({ slug: c.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = await getCircuit((await params).slug);
  if (!c) return { title: "Circuit not found" };
  const desc = `${c.name}, ${c.country}: ${c.raceCount} Formula 1 Grands Prix (${c.firstYear}–${c.lastYear}). Layouts, lap record, winners and history.`;
  return { title: c.name, description: desc, openGraph: { title: c.name, description: desc }, alternates: { canonical: `/circuits/${c.slug}` } };
}

const TYPE = { PERMANENT: "Permanent circuit", STREET: "Street circuit", ROAD: "Road course" } as const;

export default async function CircuitPage({ params }: { params: Promise<{ slug: string }> }) {
  const circuit = await getCircuit((await params).slug);
  if (!circuit) notFound();
  const [article, races, topDrivers, topTeams] = await Promise.all([
    getArticle("CIRCUIT", circuit.id),
    prisma.race.findMany({ where: { circuitId: circuit.id }, orderBy: { date: "desc" }, include: { winner: true, winnerTeam: true, pole: true } }),
    prisma.$queryRaw<{ slug: string; fullName: string; wins: number }[]>`
      SELECT d.slug, d."fullName", COUNT(*)::int AS wins FROM "Race" r JOIN "Driver" d ON d.id = r."winnerDriverId"
      WHERE r."circuitId" = ${circuit.id} GROUP BY d.slug, d."fullName" ORDER BY wins DESC, d."fullName" LIMIT 8`,
    prisma.$queryRaw<{ slug: string; name: string; color: string; wins: number }[]>`
      SELECT c.slug, c.name, c.color, COUNT(*)::int AS wins FROM "Race" r JOIN "Constructor" c ON c.id = r."winnerConstructorId"
      WHERE r."circuitId" = ${circuit.id} GROUP BY c.slug, c.name, c.color ORDER BY wins DESC LIMIT 8`,
  ]);
  const run = races.filter((r) => r.winnerDriverId);
  const placeLd = {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    name: circuit.name,
    address: { "@type": "PostalAddress", addressLocality: circuit.locality, addressCountry: circuit.country },
    geo: circuit.lat ? { "@type": "GeoCoordinates", latitude: circuit.lat, longitude: circuit.lng } : undefined,
  };

  return (
    <>
      <SetPageContext type="CIRCUIT" id={circuit.id} title={circuit.name} suggestions={[`Who has won the most at ${circuit.name}?`, `How has ${circuit.name} changed over the years?`, `What are famous moments at ${circuit.name}?`]} />
      <PageHero
        eyebrow={`${TYPE[circuit.type]} · ${circuit.country ?? ""}`}
        title={circuit.name}
        subtitle={<>{[circuit.locality, circuit.country].filter(Boolean).join(", ")} · {circuit.isActive ? "On the current calendar" : `Last Grand Prix ${circuit.lastYear}`}</>}
        crumbs={[{ label: "Circuits", href: "/circuits" }, { label: circuit.name }]}
        image={circuit.image}
        fallback={{ kind: "track", name: circuit.name }}
        actions={<><BookmarkButton href={`/circuits/${circuit.slug}`} title={circuit.name} kind="Circuit" /><ShareButton title={`${circuit.name} — GRID ARCHIVE`} /></>}
      >
        <SummarizeButton type="CIRCUIT" id={circuit.id} />
      </PageHero>
      <FactStrip
        facts={[
          { label: "Grands Prix", value: circuit.raceCount },
          { label: "First GP", value: circuit.firstYear ?? "—" },
          { label: "Last GP", value: circuit.isActive ? "Current" : circuit.lastYear ?? "—" },
          { label: "Length", value: circuit.lengthKm ? `${circuit.lengthKm} km` : "—" },
          { label: "Turns", value: circuit.turns ?? "—" },
          { label: "Type", value: <span className="text-xl">{TYPE[circuit.type]}</span> },
        ]}
      />

      <section className="shell grid gap-10 py-14 lg:grid-cols-2" aria-label="Layout and location">
        <div>
          <p className="eyebrow-accent">Track layout</p>
          {circuit.trackMap ? (
            <ArchiveImage image={circuit.trackMap} fallback={{ kind: "track", name: circuit.name }} className="mt-4 bg-white p-6" imgClassName="!object-contain max-h-[420px]" credit="below" />
          ) : (
            <div className="mt-4 aspect-[4/3]"><ArchiveImage image={null} fallback={{ kind: "track", name: circuit.name }} className="h-full" /></div>
          )}
          {circuit.lapRecord && (
            <p className="mt-6 border-l-2 border-signal pl-4">
              <span className="eyebrow block">Fastest race lap in the archive</span>
              <span className="mt-1 block text-lg font-bold">{circuit.lapRecord}</span>
              <span className="text-xs text-mist">Race fastest laps recorded since 2004; may differ from the official lap record on older layouts.</span>
            </p>
          )}
        </div>
        <div>
          <p className="eyebrow-accent">Location</p>
          {circuit.lat && circuit.lng && (
            <div className="mt-4">
              <CircuitMapLoader height={360} circuits={[{ slug: circuit.slug, name: circuit.name, country: circuit.country, lat: circuit.lat, lng: circuit.lng, races: circuit.raceCount, active: circuit.isActive, years: `${circuit.firstYear}–${circuit.lastYear}` }]} />
            </div>
          )}
        </div>
      </section>

      {circuit.layouts.length > 0 && (
        <section className="border-y border-rule bg-carbon py-14" aria-labelledby="layouts">
          <div className="shell">
            <SectionHeading eyebrow="Configurations" title="Layouts by era" id="layouts" />
            <ol className="grid gap-px bg-rule md:grid-cols-2">
              {circuit.layouts.map((l) => (
                <li key={l.id} className="bg-carbon p-6">
                  <p className="stat-num text-3xl text-signal-bright">{l.fromYear}–{l.toYear ?? "today"}</p>
                  <h3 className="mt-2 text-xl font-bold">{l.name}</h3>
                  {l.lengthKm && <p className="text-sm text-mist">{l.lengthKm} km{l.turns ? ` · ${l.turns} turns` : ""}</p>}
                  {l.notes && <p className="mt-3 text-white/85">{l.notes}</p>}
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      <ArticleSection article={article ? { ...article, sources: articleSources(article.sources) } : null} eyebrow="History" />

      <section className="shell grid gap-12 py-16 lg:grid-cols-2" aria-label="Most successful">
        <div>
          <SectionHeading eyebrow="Masters of the track" title="Most wins: drivers" />
          <ol className="divide-y divide-rule border-y border-rule">
            {topDrivers.map((d, i) => (
              <li key={d.slug} className="flex items-baseline gap-4 py-3">
                <span className="w-6 tabular-nums text-mist">{i + 1}</span>
                <Link href={`/drivers/${d.slug}`} className="link-quiet flex-1 font-semibold">{d.fullName}</Link>
                <span className="stat-num text-2xl">{d.wins}</span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <SectionHeading eyebrow="Masters of the track" title="Most wins: teams" />
          <ol className="divide-y divide-rule border-y border-rule">
            {topTeams.map((t, i) => (
              <li key={t.slug} className="flex items-baseline gap-4 py-3">
                <span className="w-6 tabular-nums text-mist">{i + 1}</span>
                <span className="h-3 w-1.5 self-center" style={{ background: t.color }} aria-hidden="true" />
                <Link href={`/teams/${t.slug}`} className="link-quiet flex-1 font-semibold">{t.name}</Link>
                <span className="stat-num text-2xl">{t.wins}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="shell pb-16" aria-labelledby="gps">
        <SectionHeading eyebrow={`${run.length} races`} title="Every Grand Prix held here" id="gps" />
        <SortableTable
          caption={`Grands Prix at ${circuit.name}`}
          columns={[{ label: "Year", numeric: true }, { label: "Grand Prix" }, { label: "Date" }, { label: "Winner" }, { label: "Constructor" }, { label: "Pole" }]}
          initialDir="desc"
          rows={races.map((r) => ({
            key: r.id,
            sort: [r.year, r.name, r.date.getTime(), r.winner?.familyName ?? null, r.winnerTeam?.name ?? null, r.pole?.familyName ?? null],
            cells: [
              <Link key="y" href={`/seasons/${r.year}`} className="link-quiet font-bold">{r.year}</Link>,
              <Link key="n" href={`/seasons/${r.year}/${r.slug}`} className="link-quiet">{r.name}</Link>,
              formatDate(r.date),
              r.winner ? <Link key="w" href={`/drivers/${r.winner.slug}`} className="link-quiet">{r.winner.fullName}</Link> : "—",
              r.winnerTeam ? <Link key="t" href={`/teams/${r.winnerTeam.slug}`} className="link-quiet">{r.winnerTeam.name}</Link> : "—",
              r.pole?.fullName ?? "—",
            ],
          }))}
        />
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(placeLd) }} />
    </>
  );
}
