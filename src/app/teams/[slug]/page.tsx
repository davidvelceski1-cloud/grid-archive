import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { articleSources, getArticle } from "@/lib/queries";
import { getLineage } from "@/lib/lineage";
import { formatPoints } from "@/lib/text";
import { ArticleSection, FactStrip, PageHero, SectionHeading } from "@/components/PageBlocks";
import { BookmarkButton, ShareButton, SummarizeButton } from "@/components/PageTools";
import { SortableTable } from "@/components/SortableTable";
import { LineageTree } from "@/components/LineageTree";
import { ArchiveImage } from "@/components/ArchiveImage";
import { SetPageContext } from "@/components/chat/pageContext";

export const revalidate = 3600;

const getTeam = cache((slug: string) =>
  prisma.team.findUnique({
    where: { slug },
    include: { image: true, chassis: { orderBy: { year: "asc" }, include: { engine: true, image: true } }, standings: { orderBy: { year: "asc" } } },
  }),
);

export async function generateStaticParams() {
  try {
    return (await prisma.team.findMany({ where: { entries: { gt: 0 } }, select: { slug: true } })).map((t) => ({ slug: t.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const t = await getTeam((await params).slug);
  if (!t) return { title: "Team not found" };
  const desc = `${t.name} (${t.firstYear}–${t.status === "ACTIVE" ? "present" : t.lastYear}): ${t.entries} races, ${t.wins} wins, ${t.constructorTitles} constructors' titles. History, lineage, cars and drivers.`;
  return { title: t.name, description: desc, openGraph: { title: `${t.name} — team history`, description: desc }, alternates: { canonical: `/teams/${t.slug}` } };
}

const STATUS = { ACTIVE: "Active", DEFUNCT: "Defunct", BECAME_ANOTHER_TEAM: "Became another team" } as const;

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const team = await getTeam((await params).slug);
  if (!team) notFound();

  const [article, lineage, seasons, drivers] = await Promise.all([
    getArticle("TEAM", team.id),
    getLineage(team.id),
    prisma.$queryRaw<{ year: number; engines: string[] | null; drivers: string[]; best: number | null; wins: number; podiums: number }[]>`
      SELECT ra.year, array_remove(array_agg(DISTINCT r.engine), NULL) AS engines,
             array_agg(DISTINCT d.slug || '|' || d."fullName") AS drivers,
             MIN(r.position)::int AS best,
             COUNT(*) FILTER (WHERE r.position = 1)::int AS wins,
             COUNT(*) FILTER (WHERE r.position <= 3)::int AS podiums
      FROM "Result" r JOIN "Race" ra ON ra.id = r."raceId" JOIN "Driver" d ON d.id = r."driverId"
      WHERE r."constructorId" = ${team.id} AND r."isSprint" = false
      GROUP BY ra.year ORDER BY ra.year`,
    prisma.$queryRaw<{ slug: string; fullName: string; nationality: string | null; first: number; last: number; starts: number; wins: number; image: string | null }[]>`
      SELECT d.slug, d."fullName", d.nationality, MIN(ra.year)::int AS first, MAX(ra.year)::int AS last,
             COUNT(DISTINCT r."raceId")::int AS starts, COUNT(*) FILTER (WHERE r.position = 1)::int AS wins, i.path AS image
      FROM "Result" r JOIN "Race" ra ON ra.id = r."raceId" JOIN "Driver" d ON d.id = r."driverId" LEFT JOIN "Image" i ON i.id = d."imageId"
      WHERE r."constructorId" = ${team.id} AND r."isSprint" = false
      GROUP BY d.slug, d."fullName", d.nationality, i.path ORDER BY starts DESC`,
  ]);
  const standings = new Map(team.standings.map((s) => [s.year, s]));
  const teamSeasons = new Map((await prisma.teamSeason.findMany({ where: { teamId: team.id } })).map((t) => [t.year, t]));
  const chassisByYear = new Map<number, typeof team.chassis>();
  for (const c of team.chassis) chassisByYear.set(c.year, [...(chassisByYear.get(c.year) ?? []), c]);
  const defunct = team.status !== "ACTIVE";
  const years = team.firstYear ? `${team.firstYear}–${team.status === "ACTIVE" ? "present" : team.lastYear}` : "";

  const orgLd = {
    "@context": "https://schema.org",
    "@type": "SportsTeam",
    name: team.name,
    sport: "Formula One",
    foundingDate: team.founded ? String(team.founded) : undefined,
    founder: team.founder ?? undefined,
    location: team.base ?? undefined,
    sameAs: team.url ?? undefined,
  };

  return (
    <>
      <SetPageContext
        type="TEAM"
        id={team.id}
        title={team.name}
        suggestions={[
          `What is the history of ${team.name}?`,
          `Who were ${team.name}'s most successful drivers?`,
          defunct ? `What happened to ${team.name}?` : `When did ${team.name} last win a title?`,
          `Which cars did ${team.name} race?`,
        ]}
      />
      <PageHero
        eyebrow={`Team history · ${STATUS[team.status]}`}
        title={team.name}
        subtitle={[team.nationality, years, team.base].filter(Boolean).join(" · ")}
        crumbs={[{ label: "Teams", href: "/teams" }, { label: team.name }]}
        image={team.image}
        fallback={{ kind: "team", name: "", color: team.color }}
        accent={team.color}
        actions={<><BookmarkButton href={`/teams/${team.slug}`} title={team.name} kind="Team" /><ShareButton title={`${team.name} — GRID ARCHIVE`} /></>}
      >
        <dl className="mt-8 grid max-w-3xl grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-4">
          {[["Founded", team.founded], ["Founder", team.founder], ["Base", team.base], ["Status", STATUS[team.status]]].map(([k, v]) =>
            v ? (
              <div key={String(k)}>
                <dt className="eyebrow">{k}</dt>
                <dd className="mt-1 text-white">{String(v)}</dd>
              </div>
            ) : null,
          )}
        </dl>
        <SummarizeButton type="TEAM" id={team.id} />
      </PageHero>

      <FactStrip
        facts={[
          { label: "Races", value: team.entries },
          { label: "Wins", value: team.wins },
          { label: "Pole positions", value: team.poles },
          { label: "Podiums", value: team.podiums },
          { label: "Constructors' titles", value: team.constructorTitles },
          { label: "Drivers' titles", value: team.driverTitles },
        ]}
      />

      {lineage.edges.length > 0 && (
        <section className="shell py-14" aria-labelledby="lineage">
          <SectionHeading eyebrow="Ownership & names" title="Lineage" id="lineage" />
          <LineageTree lineage={lineage} currentId={team.id} />
        </section>
      )}

      {defunct && team.whyDisappeared && (
        <section className="border-y border-rule bg-carbon" aria-labelledby="why">
          <div className="shell grid-12 gap-y-6 py-14">
            <div className="col-span-4 sm:col-span-8 lg:col-span-4">
              <p className="eyebrow-accent">{team.status === "BECAME_ANOTHER_TEAM" ? "What it became" : "The end"}</p>
              <h2 id="why" className="mt-2 text-display-md">Why they disappeared</h2>
            </div>
            <p className="col-span-4 text-xl leading-relaxed text-white/90 sm:col-span-8 lg:col-span-7 lg:col-start-6">{team.whyDisappeared}</p>
          </div>
        </section>
      )}

      <ArticleSection article={article ? { ...article, sources: articleSources(article.sources) } : null} eyebrow="Team history" />

      <section className="shell py-16" aria-labelledby="by-season">
        <SectionHeading eyebrow={`${seasons.length} seasons`} title="Season by season" id="by-season" />
        <SortableTable
          caption={`${team.name} results by season`}
          columns={[{ label: "Year", numeric: true }, { label: "Chassis" }, { label: "Engine" }, { label: "Drivers" }, { label: "Wins", numeric: true }, { label: "Points", numeric: true }, { label: "Pos", numeric: true }]}
          initialSort={0}
          initialDir="asc"
          dense
          rows={seasons.map((s) => {
            const st = standings.get(s.year);
            const cars = chassisByYear.get(s.year) ?? [];
            const ts = teamSeasons.get(s.year);
            // Season entry lists first; the curated register and results data fill any gaps.
            const chassis = ts?.chassis.length ? ts.chassis : cars.map((c) => c.name);
            const engines = ts?.engines.length
              ? ts.engines
              : [...new Set([...(s.engines ?? []), ...cars.map((c) => c.engine?.manufacturer).filter((x): x is string => Boolean(x))])];
            return {
              key: String(s.year),
              highlight: st?.position === 1,
              sort: [s.year, chassis[0] ?? "", engines.join(), s.drivers.length, s.wins, st?.points ?? null, st?.position ?? null],
              cells: [
                <Link key="y" href={`/seasons/${s.year}`} className="link-quiet font-bold">{s.year}</Link>,
                chassis.length ? (
                  <span key="c">
                    {chassis.map((name, i) => {
                      const reg = cars.find((c) => c.name.toLowerCase().endsWith(name.toLowerCase()));
                      return (
                        <span key={name}>
                          {i > 0 && ", "}
                          {reg ? <a href="#car-gallery" className="link-quiet font-semibold">{name}</a> : name}
                        </span>
                      );
                    })}
                  </span>
                ) : (
                  <span className="text-steel">—</span>
                ),
                engines.length ? <span key="e" className="text-white/85">{engines.join(", ")}</span> : <span className="text-steel">—</span>,
                <span key="d" className="text-white/85">
                  {s.drivers.map((d, i) => {
                    const [slug, name] = d.split("|");
                    return <span key={slug}>{i > 0 && ", "}<Link href={`/drivers/${slug}`} className="link-quiet">{name}</Link></span>;
                  })}
                </span>,
                s.wins,
                st ? formatPoints(st.points) : "—",
                st?.positionText ?? (s.year < 1958 ? "n/a" : "—"),
              ],
            };
          })}
        />
        <p className="mt-3 text-xs text-mist">
          Chassis and engines come from the entry lists in each season&apos;s Wikipedia article (CC BY-SA 4.0); highlighted chassis have a photo in the car gallery below.
        </p>
      </section>

      {team.chassis.length > 0 && (
        <section className="border-t border-rule bg-carbon py-16" aria-labelledby="car-gallery">
          <div className="shell">
            <SectionHeading eyebrow="Car gallery" title="Notable cars" id="car-gallery" />
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {team.chassis.map((c) => (
                <li key={c.id} className="border border-rule bg-ink">
                  <ArchiveImage image={c.image} fallback={{ kind: "team", name: c.name, color: team.color }} className="aspect-[16/9]" credit="overlay" />
                  <div className="p-5">
                    <p className="eyebrow">{c.year}</p>
                    <h3 className="mt-1 text-xl font-bold">{c.name}</h3>
                    <dl className="mt-3 space-y-1 text-sm">
                      {c.engine && <div className="flex gap-2"><dt className="text-mist">Engine</dt><dd>{c.engine.manufacturer} {c.engine.name} · {c.engine.configuration}</dd></div>}
                      {c.designer && <div className="flex gap-2"><dt className="text-mist">Designer</dt><dd>{c.designer}</dd></div>}
                    </dl>
                    {c.notes && <p className="mt-3 text-sm text-white/80">{c.notes}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="shell py-16" aria-labelledby="drivers">
        <SectionHeading eyebrow={`${drivers.length} drivers`} title={`Who raced for ${team.name}`} id="drivers" />
        <ul className="grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
          {drivers.map((d) => (
            <li key={d.slug}>
              <Link href={`/drivers/${d.slug}`} className="card-zoom group block">
                <div className="aspect-square overflow-hidden bg-graphite">
                  {d.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.image.replace(/-\d+\.webp$/, "-320.webp")} alt={`Portrait of ${d.fullName}`} loading="lazy" className="h-full w-full object-cover grayscale-[30%] group-hover:grayscale-0" />
                  ) : (
                    <div className="flex h-full items-center justify-center font-display text-3xl font-extrabold text-white/40">{d.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("")}</div>
                  )}
                </div>
                <p className="mt-2 font-bold leading-tight group-hover:text-signal-bright">{d.fullName}</p>
                <p className="text-xs text-mist">{d.first === d.last ? d.first : `${d.first}–${d.last}`} · {d.starts} starts{d.wins ? ` · ${d.wins} wins` : ""}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }} />
    </>
  );
}
