import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Reveal } from "@/components/Reveal";
import { ArchiveImage } from "@/components/ArchiveImage";
import { eraHero } from "@/lib/queries";

export const revalidate = 3600;
export const metadata: Metadata = { title: "Eras", description: "The eras of Formula 1 history, from the front-engined pioneers of 1950 to the 2026 regulations." };

export default async function ErasPage() {
  const eras = await prisma.era.findMany({ orderBy: { order: "asc" }, include: { seasons: { include: { championDriver: { include: { image: true } } }, orderBy: { year: "asc" } } } });
  return (
    <div className="pb-20 pt-10">
      <div className="shell">
        <Breadcrumbs items={[{ label: "Eras" }]} />
        <p className="eyebrow-accent mt-10">Seventy-five years in ten chapters</p>
        <h1 className="mt-3 text-display-xl">Eras</h1>
      </div>
      <ol className="mt-12">
        {eras.map((e, i) => {
          const champs = [...new Map(e.seasons.filter((s) => s.championDriver).map((s) => [s.championDriver!.fullName, s.championDriver!])).values()];
          return (
            <Reveal as="li" key={e.slug}>
              <Link href={`/eras/${e.slug}`} className="group block border-t border-rule hover:bg-white/[0.03]">
                <div className="shell grid-12 gap-y-4 py-10">
                  <div className="card-zoom relative col-span-4 aspect-[4/3] overflow-hidden sm:col-span-2">
                    <ArchiveImage image={eraHero(e.seasons)?.image ?? null} fallback={{ kind: "season", label: String(e.startYear) }} className="h-full w-full" sizes="(min-width:1024px) 16vw, 50vw" imgClassName="grayscale-[40%] group-hover:grayscale-0" />
                    <span className="stat-num absolute bottom-1 left-2 text-3xl text-white [text-shadow:0_1px_6px_rgba(0,0,0,.7)]">{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <div className="col-span-4 sm:col-span-6 lg:col-span-6">
                    <p className="eyebrow">{e.startYear}–{e.endYear ?? "present"}</p>
                    <h2 className="mt-2 text-display-md group-hover:text-signal-bright">{e.name}</h2>
                    <p className="mt-3 text-lg text-white/80">{e.tagline}</p>
                  </div>
                  <div className="col-span-4 text-sm text-mist sm:col-span-8 lg:col-span-4">
                    <p>{e.summary}</p>
                    {champs.length > 0 && <p className="mt-3"><span className="eyebrow">Champions</span> <span className="text-white/80">{champs.map((c) => c.fullName).join(", ")}</span></p>}
                  </div>
                </div>
              </Link>
            </Reveal>
          );
        })}
      </ol>
    </div>
  );
}
