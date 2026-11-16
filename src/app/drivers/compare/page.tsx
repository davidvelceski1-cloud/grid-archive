import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatPoints } from "@/lib/text";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { DriverPicker } from "@/components/browse/DriverPicker";
import { CompareLines } from "@/components/charts/Charts";
import { SERIES } from "@/lib/palette";
import { ArchiveImage } from "@/components/ArchiveImage";

export const metadata: Metadata = {
  title: "Compare drivers",
  description: "Compare up to three Formula 1 drivers side by side: wins, poles, podiums, titles, win rate and career progression.",
};

const PRESETS = [
  ["ayrton-senna", "alain-prost"],
  ["michael-schumacher", "lewis-hamilton", "max-verstappen"],
  ["jim-clark", "jackie-stewart"],
  ["niki-lauda", "james-hunt"],
];

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const slugs = ((await searchParams).d ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 3);
  const found = await prisma.driver.findMany({ where: { slug: { in: slugs } }, include: { image: true, standings: { orderBy: { year: "asc" } } } });
  const drivers = slugs.map((s) => found.find((d) => d.slug === s)).filter((d): d is (typeof found)[number] => Boolean(d));

  const metrics: { label: string; get: (d: (typeof drivers)[number]) => number; fmt?: (n: number) => string }[] = [
    { label: "Starts", get: (d) => d.starts },
    { label: "Wins", get: (d) => d.wins },
    { label: "Pole positions", get: (d) => d.poles },
    { label: "Podiums", get: (d) => d.podiums },
    { label: "World titles", get: (d) => d.titles },
    { label: "Career points", get: (d) => d.points, fmt: formatPoints },
    { label: "Win rate", get: (d) => (d.starts ? (d.wins / d.starts) * 100 : 0), fmt: (n) => `${n.toFixed(1)}%` },
    { label: "Pole rate", get: (d) => (d.starts ? (d.poles / d.starts) * 100 : 0), fmt: (n) => `${n.toFixed(1)}%` },
    { label: "Podium rate", get: (d) => (d.starts ? (d.podiums / d.starts) * 100 : 0), fmt: (n) => `${n.toFixed(1)}%` },
    { label: "Seasons", get: (d) => d.standings.length },
  ];

  // Cumulative wins by career season (season 1, 2, 3…) so different eras align.
  const maxSeasons = Math.max(0, ...drivers.map((d) => d.standings.length));
  const winRows = Array.from({ length: maxSeasons }, (_, i) => {
    const row: Record<string, number | string> = { x: i + 1 };
    for (const d of drivers) {
      if (i < d.standings.length) row[d.id] = d.standings.slice(0, i + 1).reduce((s, x) => s + x.wins, 0);
    }
    return row;
  });
  const posRows = Array.from({ length: maxSeasons }, (_, i) => {
    const row: Record<string, number | string> = { x: i + 1 };
    for (const d of drivers) {
      const s = d.standings[i];
      if (s?.position) row[d.id] = s.position;
    }
    return row;
  });
  const series = drivers.map((d) => ({ id: d.id, name: d.fullName }));

  return (
    <div className="shell pb-20 pt-10">
      <Breadcrumbs items={[{ label: "Drivers", href: "/drivers" }, { label: "Compare" }]} />
      <p className="eyebrow-accent mt-10">Analysis tool</p>
      <h1 className="mt-3 text-display-lg">Compare drivers</h1>
      <p className="mb-8 mt-4 max-w-2xl text-lg text-white/80">Pick two or three drivers to see their careers side by side. Charts align careers by season number so different eras can be compared.</p>
      <DriverPicker selected={drivers.map((d) => ({ slug: d.slug, name: d.fullName }))} />

      {drivers.length < 2 && (
        <div className="mt-10">
          <p className="eyebrow mb-3">Classic match-ups</p>
          <ul className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <li key={p.join()}>
                <Link href={`/drivers/compare?d=${p.join(",")}`} className="chip normal-case tracking-normal">
                  {p.map((s) => s.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")).join(" vs ")}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {drivers.length >= 1 && (
        <>
          <div className="mt-12 overflow-x-auto">
            <table className="table-archive min-w-[560px]">
              <caption className="sr-only">Career statistics comparison</caption>
              <thead>
                <tr>
                  <th scope="col" className="w-44">Statistic</th>
                  {drivers.map((d, i) => (
                    <th key={d.id} scope="col" className="text-right normal-case tracking-normal">
                      <Link href={`/drivers/${d.slug}`} className="inline-flex flex-col items-end gap-2 text-white hover:text-signal-bright">
                        <ArchiveImage image={d.image} fallback={{ kind: "initials", name: d.fullName }} className="h-20 w-16" />
                        <span className="flex items-center gap-2 text-base font-bold">
                          <span className="h-3 w-3" style={{ background: SERIES[i] }} aria-hidden="true" />
                          {d.fullName}
                        </span>
                        <span className="text-xs font-medium text-mist">{d.firstYear}–{d.lastYear}</span>
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metrics.map((m) => {
                  const vals = drivers.map(m.get);
                  const best = Math.max(...vals);
                  return (
                    <tr key={m.label}>
                      <th scope="row" className="font-normal text-mist">{m.label}</th>
                      {vals.map((v, i) => (
                        <td key={i} className={`text-right text-lg tabular-nums ${drivers.length > 1 && v === best && v > 0 ? "font-extrabold text-white" : "text-white/75"}`}>
                          {m.fmt ? m.fmt(v) : v}
                          {drivers.length > 1 && v === best && v > 0 && <span className="sr-only"> (highest)</span>}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {drivers.length >= 2 && (
            <div className="mt-12 grid gap-8 lg:grid-cols-2">
              <CompareLines rows={winRows} series={series} xLabel="Season" title="Cumulative wins by career season" description="Season 1 = each driver's first World Championship season." />
              <CompareLines rows={posRows} series={series} xLabel="Season" title="Championship position by career season" description="Top of the chart = World Champion." reversed />
            </div>
          )}
        </>
      )}
    </div>
  );
}
