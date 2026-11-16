import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ArchiveImage } from "@/components/ArchiveImage";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Reveal } from "@/components/Reveal";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Seasons",
  description: "Every Formula 1 World Championship season from 1950 to today, grouped by decade, with champions and full results.",
};

export default async function SeasonsPage() {
  const seasons = await prisma.season.findMany({
    orderBy: { year: "desc" },
    include: { championDriver: { include: { image: true } }, championConstructor: true },
  });
  const decades = new Map<number, typeof seasons>();
  for (const s of seasons) {
    const d = Math.floor(s.year / 10) * 10;
    decades.set(d, [...(decades.get(d) ?? []), s]);
  }

  return (
    <>
      <header className="shell pb-10 pt-10">
        <Breadcrumbs items={[{ label: "Seasons" }]} />
        <p className="eyebrow-accent mt-10">Season archive</p>
        <h1 className="mt-3 text-display-xl">Every season, {seasons.at(-1)?.year}–{seasons[0]?.year}</h1>
        <p className="mt-5 max-w-2xl text-lg text-white/80">
          {seasons.length} World Championship seasons. Open any year for the race-by-race calendar, final standings, the title fight in numbers and the story of the season.
        </p>
        <nav aria-label="Jump to decade" className="mt-8 flex flex-wrap gap-2">
          {[...decades.keys()].map((d) => (
            <a key={d} href={`#d${d}`} className="chip">{d}s</a>
          ))}
        </nav>
      </header>

      {[...decades].map(([decade, list]) => (
        <section key={decade} id={`d${decade}`} className="shell scroll-mt-20 border-t border-rule py-12" aria-labelledby={`h${decade}`}>
          <h2 id={`h${decade}`} className="mb-8 text-display-md">
            The {decade}s
          </h2>
          <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
            {list.map((s, i) => (
              <Reveal as="li" key={s.year} delay={(i % 5) * 50}>
                <Link href={`/seasons/${s.year}`} className="card-zoom group block">
                  <div className="relative aspect-[4/5] overflow-hidden bg-graphite">
                    <ArchiveImage image={s.championDriver?.image} fallback={{ kind: "season", label: String(s.year) }} className="h-full w-full" sizes="(min-width:1024px) 20vw, 50vw" imgClassName="opacity-85 grayscale-[35%] group-hover:grayscale-0" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
                    <span className="stat-num absolute bottom-2 left-3 text-5xl text-white">{s.year}</span>
                    {s.championConstructor && <span className="absolute inset-x-0 top-0 h-1" style={{ background: "#E4002B" }} aria-hidden="true" />}
                  </div>
                  <div className="border-b border-rule py-3">
                    <p className="text-[0.66rem] font-bold uppercase tracking-[0.16em] text-mist">{s.championDriver ? "Champion" : "In progress"}</p>
                    <p className="font-bold leading-tight text-white group-hover:text-signal-bright">{s.championDriver?.fullName ?? `${s.rounds} rounds scheduled`}</p>
                    <p className="text-sm text-mist">{s.championConstructor?.name ?? (s.year < 1958 ? "No constructors' title" : "—")}</p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
