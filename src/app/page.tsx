import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/text";
import { getOnThisDay } from "@/lib/onThisDay";
import { HeroCarousel, type HeroStory } from "@/components/home/HeroCarousel";
import { Timeline } from "@/components/home/Timeline";
import { Carousel } from "@/components/home/Carousel";
import { ArchiveImage, srcSetOf } from "@/components/ArchiveImage";
import { SectionHeading } from "@/components/PageBlocks";
import { StatCounter } from "@/components/StatCounter";
import { Reveal } from "@/components/Reveal";

export const revalidate = 3600;

const CLASSIC_SEASONS = [1976, 1988, 2008, 1982, 2021, 1961, 1984, 2010, 1994, 1958, 1964, 1986, 2012, 2016, 1997, 2007, 1950, 1970, 1999, 2003];

function weekNumber(d: Date) {
  return Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / (7 * 86_400_000));
}

async function heroStories(): Promise<HeroStory[]> {
  const now = new Date();
  const week = weekNumber(now);
  const stories: HeroStory[] = [];
  const asHero = (img: Parameters<typeof srcSetOf>[0] | null | undefined) => (img ? { ...img, srcSet: srcSetOf(img) } : null);

  // This week in history: a past race within ±3 days of today's date.
  const m = now.getUTCMonth() + 1;
  const d = now.getUTCDate();
  const candidates = await prisma.$queryRaw<{ id: string }[]>`
    SELECT r.id FROM "Race" r JOIN "Driver" w ON w.id = r."winnerDriverId"
    WHERE r.year < ${now.getUTCFullYear()}
      AND ABS((EXTRACT(DOY FROM make_date(2001, EXTRACT(MONTH FROM r.date)::int, LEAST(EXTRACT(DAY FROM r.date)::int, 28))) - EXTRACT(DOY FROM make_date(2001, ${m}::int, LEAST(${d}::int, 28))))) <= 3
    ORDER BY w.titles DESC, w.wins DESC LIMIT 6`;
  if (candidates.length) {
    const pick = candidates[week % candidates.length];
    const race = await prisma.race.findUnique({ where: { id: pick.id }, include: { winner: { include: { image: true } }, winnerTeam: true, circuit: { include: { image: true } } } });
    if (race?.winner) {
      stories.push({
        kicker: "This week in F1 history",
        title: `${race.year} ${race.name}`,
        dek: `${race.winner.fullName} won${race.winnerTeam ? ` for ${race.winnerTeam.name}` : ""} at ${race.circuit.name} on ${formatDate(race.date)}.`,
        href: `/seasons/${race.year}/${race.slug}`,
        image: asHero(race.circuit.image ?? race.winner.image),
      });
    }
  }

  const classic = CLASSIC_SEASONS[week % CLASSIC_SEASONS.length];
  const season = await prisma.season.findUnique({ where: { year: classic }, include: { championDriver: { include: { image: true } }, championConstructor: true } });
  if (season) {
    stories.push({
      kicker: "Featured season",
      title: `The ${season.year} season`,
      dek: season.headline ?? `${season.championDriver?.fullName} and ${season.championConstructor?.name ?? ""}.`,
      href: `/seasons/${season.year}`,
      image: asHero(season.championDriver?.image),
    });
  }

  const lost = await prisma.team.findMany({ where: { status: { not: "ACTIVE" }, whyDisappeared: { not: null }, entries: { gte: 20 } }, include: { image: true }, orderBy: { wins: "desc" } });
  if (lost.length) {
    const t = lost[week % lost.length];
    stories.push({
      kicker: "Lost teams",
      title: `What happened to ${t.name}?`,
      dek: `${t.firstYear}–${t.lastYear} · ${t.entries} races · ${t.wins} wins. ${t.whyDisappeared?.split(". ")[0]}.`,
      href: `/teams/${t.slug}`,
      image: asHero(t.image),
      color: t.color,
    });
  }

  const latest = await prisma.season.findFirst({ orderBy: { year: "desc" }, include: { championDriver: { include: { image: true } } } });
  if (latest) {
    const leader = await prisma.driverStanding.findFirst({ where: { year: latest.year }, orderBy: { points: "desc" }, include: { driver: { include: { image: true } } } });
    stories.push({
      kicker: `Season ${latest.year}`,
      title: latest.championDriver ? `${latest.championDriver.fullName}, ${latest.year} World Champion` : `The ${latest.year} title fight`,
      dek: latest.headline ?? (leader ? `${leader.driver.fullName} leads with ${leader.points} points.` : "Follow the current season round by round."),
      href: `/seasons/${latest.year}`,
      image: asHero(leader?.driver.image ?? latest.championDriver?.image),
    });
  }
  return stories;
}

export default async function HomePage() {
  const [stories, eras, seasons, lostTeams, counts, records, otd, tiles] = await Promise.all([
    heroStories(),
    prisma.era.findMany({ orderBy: { order: "asc" } }),
    prisma.season.findMany({ orderBy: { year: "asc" }, select: { year: true, championDriver: { select: { fullName: true } }, championConstructor: { select: { name: true } } } }),
    prisma.team.findMany({ where: { status: { not: "ACTIVE" }, entries: { gte: 30 } }, orderBy: [{ wins: "desc" }, { entries: "desc" }], take: 12, include: { image: true } }),
    Promise.all([prisma.race.count({ where: { winnerDriverId: { not: null } } }), prisma.driver.count({ where: { starts: { gt: 0 } } }), prisma.team.count({ where: { entries: { gt: 0 } } }), prisma.circuit.count({ where: { raceCount: { gt: 0 } } })]),
    Promise.all([
      prisma.driver.findFirst({ orderBy: { wins: "desc" } }),
      prisma.driver.findFirst({ orderBy: [{ titles: "desc" }, { wins: "desc" }] }),
      prisma.team.findFirst({ orderBy: { wins: "desc" } }),
      prisma.driver.findFirst({ orderBy: { poles: "desc" } }),
    ]),
    getOnThisDay(),
    Promise.all([
      prisma.driver.findFirst({ where: { titles: { gt: 0 }, imageId: { not: null } }, orderBy: { lastYear: "desc" }, include: { image: true } }),
      prisma.team.findFirst({ where: { imageId: { not: null }, constructorTitles: { gt: 0 } }, orderBy: { lastYear: "asc" }, include: { image: true } }),
      prisma.circuit.findFirst({ where: { id: "monaco" }, include: { image: true } }),
      prisma.driver.findFirst({ where: { imageId: { not: null }, titles: { gte: 3 } }, orderBy: { firstYear: "asc" }, include: { image: true } }),
    ]),
  ]);
  const [raceCount, driverCount, teamCount, circuitCount] = counts;
  const [mostWins, mostTitles, teamWins, mostPoles] = records;
  const latestYear = seasons.at(-1)?.year ?? new Date().getFullYear();
  const [tileDriver, tileTeam, tileCircuit, tileSeason] = tiles;

  const explore = [
    { href: "/seasons", label: "Seasons", count: `${seasons.length} seasons`, text: "Year by year since 1950: every race, every standing, every story.", image: tileSeason?.image },
    { href: "/teams", label: "Teams", count: `${teamCount} constructors`, text: "Works giants, garage heroes and the teams that vanished.", image: tileTeam?.image },
    { href: "/drivers", label: "Drivers", count: `${driverCount} starters`, text: "Every driver who started a World Championship Grand Prix.", image: tileDriver?.image },
    { href: "/circuits", label: "Circuits", count: `${circuitCount} venues`, text: "From street circuits to the old Nordschleife, mapped and measured.", image: tileCircuit?.image },
  ];

  return (
    <>
      <HeroCarousel stories={stories} />

      {/* Explore the Archive */}
      <section className="shell py-20 lg:py-28" aria-labelledby="explore">
        <SectionHeading eyebrow="The collection" title="Explore the Archive" id="explore" />
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {explore.map((t, i) => (
            <Reveal as="li" key={t.href} delay={i * 80}>
              <Link href={t.href} className="card-zoom group relative block aspect-[3/4] overflow-hidden bg-graphite">
                <ArchiveImage image={t.image} fallback={{ kind: "season", label: t.label }} className="absolute inset-0 h-full w-full" sizes="(min-width:1024px) 25vw, 50vw" imgClassName="opacity-80" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6">
                  <p className="eyebrow-accent">{t.count}</p>
                  <h3 className="mt-2 text-4xl font-extrabold tracking-tight text-white">{t.label}</h3>
                  <p className="mt-2 text-sm text-white/80">{t.text}</p>
                  <span className="mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-white group-hover:text-signal-bright">
                    Explore <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* Timeline */}
      <section className="border-y border-rule bg-carbon py-20" aria-labelledby="timeline">
        <div className="shell">
          <SectionHeading eyebrow={`1950 → ${latestYear}`} title="The timeline" id="timeline" action={{ href: "/eras", label: "All eras" }} />
          <Timeline
            eras={eras.map((e) => ({ slug: e.slug, name: e.name, startYear: e.startYear, endYear: e.endYear }))}
            years={seasons.map((s) => ({ year: s.year, champion: s.championDriver?.fullName ?? null, team: s.championConstructor?.name ?? null }))}
          />
        </div>
      </section>

      {/* On this day */}
      {(otd.races.length > 0 || otd.birthdays.length > 0) && (
        <section className="shell grid-12 gap-y-8 py-20" aria-labelledby="otd">
          <div className="col-span-4 sm:col-span-8 lg:col-span-4">
            <p className="eyebrow-accent">On this day · {otd.dateLabel}</p>
            <h2 id="otd" className="mt-2 text-display-md">On this day in F1 history</h2>
            {otd.aiGenerated && <p className="mt-3 text-xs uppercase tracking-[0.14em] text-mist">AI-written from archive data</p>}
          </div>
          <div className="col-span-4 sm:col-span-8 lg:col-span-7 lg:col-start-6">
            {otd.body && <p className="mb-6 text-xl leading-relaxed text-white/90">{otd.body}</p>}
            <ul className="divide-y divide-rule border-y border-rule">
              {otd.races.slice(0, 6).map((r) => (
                <li key={r.href}>
                  <Link href={r.href} className="flex items-baseline gap-4 py-3 hover:bg-white/5">
                    <span className="stat-num w-14 text-xl text-signal-bright">{r.year}</span>
                    <span className="font-bold text-white">{r.name}</span>
                    <span className="ml-auto text-sm text-mist">{r.winner}</span>
                  </Link>
                </li>
              ))}
              {otd.birthdays.slice(0, 3).map((b) => (
                <li key={b.href}>
                  <Link href={b.href} className="flex items-baseline gap-4 py-3 hover:bg-white/5">
                    <span className="stat-num w-14 text-xl text-mist">{b.year}</span>
                    <span className="text-white">Born: <span className="font-bold">{b.name}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Lost Teams */}
      <section className="border-t border-rule py-20" aria-labelledby="lost">
        <div className="shell">
          <SectionHeading eyebrow="Spotlight" title="Lost teams" id="lost" action={{ href: "/teams?status=defunct", label: "All defunct teams" }} />
          <Carousel label="Lost teams">
            {lostTeams.map((t) => (
              <li key={t.id} className="w-[78%] shrink-0 snap-start sm:w-[46%] lg:w-[31%]">
                <Link href={`/teams/${t.slug}`} className="card-zoom group block">
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <ArchiveImage image={t.image} fallback={{ kind: "team", name: t.name, color: t.color }} className="h-full w-full" sizes="(min-width:1024px) 31vw, 78vw" />
                    <span className="absolute left-0 top-0 h-1 w-full" style={{ background: t.color }} aria-hidden="true" />
                  </div>
                  <div className="border-b border-rule py-4">
                    <p className="eyebrow">{t.firstYear}–{t.lastYear} · {t.nationality}</p>
                    <h3 className="mt-1 text-2xl font-extrabold tracking-tight text-white group-hover:text-signal-bright">{t.name}</h3>
                    <p className="mt-2 text-sm text-mist">
                      {t.entries} races · {t.wins} wins{t.constructorTitles ? ` · ${t.constructorTitles} constructors' title${t.constructorTitles > 1 ? "s" : ""}` : ""}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </Carousel>
        </div>
      </section>

      {/* Records strip */}
      <section className="border-y border-rule bg-carbon py-20" aria-labelledby="records">
        <div className="shell">
          <SectionHeading eyebrow="By the numbers" title="Records & statistics" id="records" action={{ href: "/records", label: "Records hall" }} />
          <div className="grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-4">
            <StatCounter value={raceCount} label="Grands Prix in the archive" sub={`1950 – ${latestYear}`} />
            <StatCounter value={driverCount} label="Drivers who started" />
            <StatCounter value={teamCount} label="Constructors" />
            <StatCounter value={circuitCount} label="Circuits" />
            {mostWins && <StatCounter value={mostWins.wins} label="Most Grand Prix wins" sub={mostWins.fullName} />}
            {mostTitles && <StatCounter value={mostTitles.titles} label="Most drivers' titles" sub={mostTitles.fullName} />}
            {teamWins && <StatCounter value={teamWins.wins} label="Most wins by a team" sub={teamWins.name} />}
            {mostPoles && <StatCounter value={mostPoles.poles} label="Most pole positions" sub={mostPoles.fullName} />}
          </div>
        </div>
      </section>

      {/* Ask the Archive teaser */}
      <section className="relative overflow-hidden py-24" aria-labelledby="ask-teaser">
        <div className="checker pointer-events-none absolute -right-24 top-10 h-72 w-72 rotate-12 opacity-[0.04]" aria-hidden="true" />
        <div className="shell grid-12 gap-y-10">
          <div className="col-span-4 sm:col-span-8 lg:col-span-5">
            <p className="eyebrow-accent">AI research assistant</p>
            <h2 id="ask-teaser" className="mt-2 text-display-lg">Ask the Archive</h2>
            <p className="mt-5 text-lg leading-relaxed text-white/80">
              Ask in plain language. Every answer is drawn from this archive&apos;s own database and cites the pages it used. If the archive doesn&apos;t know, it says so.
            </p>
            <Link href="/ask" className="btn mt-8">Open the assistant →</Link>
          </div>
          <ul className="col-span-4 space-y-3 sm:col-span-8 lg:col-span-6 lg:col-start-7">
            {[
              "Who won the 1976 championship and how?",
              "Which teams did Ayrton Senna drive for?",
              "Compare Lotus and Brabham in the 1970s",
              "What happened to Super Aguri?",
            ].map((q) => (
              <li key={q}>
                <Link href={`/ask?q=${encodeURIComponent(q)}`} className="group flex items-center justify-between gap-4 border border-rule bg-carbon px-5 py-4 text-lg font-semibold text-white transition-colors hover:border-signal">
                  <span>“{q}”</span>
                  <span aria-hidden="true" className="text-signal-bright transition-transform group-hover:translate-x-1">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
