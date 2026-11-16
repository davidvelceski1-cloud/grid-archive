import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { FactStrip, PageHero, SectionHeading } from "@/components/PageBlocks";
import { Markdown } from "@/components/Markdown";
import { SetPageContext } from "@/components/chat/pageContext";

export const revalidate = 3600;

export async function generateStaticParams() {
  try {
    return (await prisma.era.findMany({ select: { slug: true } })).map((e) => ({ slug: e.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const e = await prisma.era.findUnique({ where: { slug: (await params).slug } });
  return e ? { title: `${e.name} (${e.startYear}–${e.endYear ?? "present"})`, description: e.summary } : { title: "Era not found" };
}

export default async function EraPage({ params }: { params: Promise<{ slug: string }> }) {
  const era = await prisma.era.findUnique({
    where: { slug: (await params).slug },
    include: { seasons: { orderBy: { year: "asc" }, include: { championDriver: { include: { image: true } }, championConstructor: true } } },
  });
  if (!era) notFound();
  const all = await prisma.era.findMany({ orderBy: { order: "asc" }, select: { slug: true, name: true, order: true } });
  const prev = all.find((e) => e.order === era.order - 1);
  const next = all.find((e) => e.order === era.order + 1);
  const end = era.endYear ?? 2100;
  const [topDrivers, topTeams, raceCount] = await Promise.all([
    prisma.$queryRaw<{ slug: string; fullName: string; wins: number }[]>`
      SELECT d.slug, d."fullName", COUNT(*)::int AS wins FROM "Race" r JOIN "Driver" d ON d.id = r."winnerDriverId"
      WHERE r.year BETWEEN ${era.startYear} AND ${end} GROUP BY d.slug, d."fullName" ORDER BY wins DESC LIMIT 6`,
    prisma.$queryRaw<{ slug: string; name: string; color: string; wins: number }[]>`
      SELECT c.slug, c.name, c.color, COUNT(*)::int AS wins FROM "Race" r JOIN "Constructor" c ON c.id = r."winnerConstructorId"
      WHERE r.year BETWEEN ${era.startYear} AND ${end} GROUP BY c.slug, c.name, c.color ORDER BY wins DESC LIMIT 6`,
    prisma.race.count({ where: { year: { gte: era.startYear, lte: end }, winnerDriverId: { not: null } } }),
  ]);
  const heroImage = era.seasons.find((s) => s.championDriver?.image)?.championDriver?.image ?? null;

  return (
    <>
      <SetPageContext type="ERA" id={era.slug} title={`the ${era.name} era`} suggestions={[`What defined the ${era.name} era?`, `Who dominated ${era.startYear}–${era.endYear ?? "today"}?`]} />
      <PageHero
        eyebrow={`Era · ${era.startYear}–${era.endYear ?? "present"}`}
        title={era.name}
        subtitle={era.tagline}
        crumbs={[{ label: "Eras", href: "/eras" }, { label: era.name }]}
        image={heroImage}
        fallback={{ kind: "season", label: `${era.startYear}` }}
      />
      <FactStrip
        facts={[
          { label: "Seasons", value: era.seasons.length },
          { label: "Grands Prix", value: raceCount },
          { label: "Different champions", value: new Set(era.seasons.map((s) => s.championDriverId).filter(Boolean)).size },
          { label: "Top winner", value: <span className="text-xl">{topDrivers[0]?.fullName ?? "—"}</span> },
          { label: "Top team", value: <span className="text-xl">{topTeams[0]?.name ?? "—"}</span> },
          { label: "Span", value: `${era.startYear}–${era.endYear ? String(era.endYear).slice(2) : "now"}` },
        ]}
      />
      <section className="light">
        <div className="shell grid-12 py-16">
          <p className="col-span-4 mb-8 text-2xl font-semibold leading-snug sm:col-span-8 lg:col-span-3">{era.summary}</p>
          <div className="col-span-4 sm:col-span-8 lg:col-span-8 lg:col-start-5">
            <Markdown source={era.body} className="prose-archive" />
          </div>
        </div>
      </section>
      <section className="shell py-16" aria-labelledby="champions">
        <SectionHeading eyebrow="Season by season" title="Champions of the era" id="champions" />
        <ul className="grid grid-cols-2 gap-px bg-rule sm:grid-cols-3 lg:grid-cols-6">
          {era.seasons.map((s) => (
            <li key={s.year} className="bg-ink">
              <Link href={`/seasons/${s.year}`} className="block p-4 hover:bg-white/5">
                <span className="stat-num text-3xl">{s.year}</span>
                <span className="mt-1 block text-sm font-semibold">{s.championDriver?.fullName ?? "In progress"}</span>
                <span className="block text-xs text-mist">{s.championConstructor?.name ?? ""}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="shell grid gap-12 pb-16 lg:grid-cols-2">
        <div>
          <SectionHeading eyebrow="Most wins" title="Drivers" />
          <ol className="divide-y divide-rule border-y border-rule">
            {topDrivers.map((d) => <li key={d.slug} className="flex justify-between py-3"><Link href={`/drivers/${d.slug}`} className="link-quiet font-semibold">{d.fullName}</Link><span className="stat-num text-xl">{d.wins}</span></li>)}
          </ol>
        </div>
        <div>
          <SectionHeading eyebrow="Most wins" title="Teams" />
          <ol className="divide-y divide-rule border-y border-rule">
            {topTeams.map((t) => <li key={t.slug} className="flex justify-between py-3"><Link href={`/teams/${t.slug}`} className="link-quiet inline-flex items-center gap-2 font-semibold"><span className="h-3 w-1.5" style={{ background: t.color }} aria-hidden="true" />{t.name}</Link><span className="stat-num text-xl">{t.wins}</span></li>)}
          </ol>
        </div>
      </section>
      <nav aria-label="Era navigation" className="border-t border-rule">
        <div className="shell grid grid-cols-2">
          {prev ? <Link href={`/eras/${prev.slug}`} className="group border-r border-rule py-8 pr-4"><span className="eyebrow">← Previous era</span><span className="mt-1 block font-display text-2xl font-bold group-hover:text-signal-bright">{prev.name}</span></Link> : <span />}
          {next ? <Link href={`/eras/${next.slug}`} className="group py-8 pl-4 text-right"><span className="eyebrow">Next era →</span><span className="mt-1 block font-display text-2xl font-bold group-hover:text-signal-bright">{next.name}</span></Link> : <span />}
        </div>
      </nav>
    </>
  );
}
