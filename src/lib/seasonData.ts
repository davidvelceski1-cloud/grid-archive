import { cache } from "react";
import { prisma } from "./db";

export const getSeason = cache(async (year: number) =>
  prisma.season.findUnique({
    where: { year },
    include: {
      championDriver: { include: { image: true } },
      championConstructor: true,
      era: true,
      races: {
        orderBy: { round: "asc" },
        include: {
          circuit: { include: { image: true } },
          winner: true,
          winnerTeam: true,
          pole: true,
          fastestLap: true,
          results: { orderBy: [{ isSprint: "asc" }, { positionOrder: "asc" }], include: { driver: true, team: true } },
        },
      },
      driverStandings: { orderBy: [{ position: "asc" }, { points: "desc" }], include: { driver: true } },
      constructorStandings: { orderBy: [{ position: "asc" }, { points: "desc" }], include: { team: true } },
      chassis: { include: { engine: true, team: true, image: true } },
    },
  }),
);

export type SeasonData = NonNullable<Awaited<ReturnType<typeof getSeason>>>;

/** Cumulative points per round (race + sprint) for the top-N drivers of the final standings. */
export function progression(season: SeasonData, topN = 6) {
  const top = season.driverStandings.slice(0, topN).map((s) => s.driver);
  const totals = new Map(top.map((d) => [d.id, 0]));
  const rows: Record<string, number | string>[] = [{ round: 0, label: "Start", ...Object.fromEntries(top.map((d) => [d.id, 0])) }];
  for (const race of season.races) {
    if (!race.winnerDriverId) break;
    for (const r of race.results) if (totals.has(r.driverId)) totals.set(r.driverId, totals.get(r.driverId)! + r.points);
    rows.push({ round: race.round, label: `R${race.round} ${race.name.replace(" Grand Prix", " GP")}`, ...Object.fromEntries([...totals].map(([k, v]) => [k, Math.round(v * 10) / 10])) });
  }
  return { rows, series: top.map((d) => ({ id: d.id, name: d.fullName })) };
}

/** Teams on the grid with their drivers that season. */
export function gridOf(season: SeasonData) {
  const teams = new Map<string, { id: string; name: string; slug: string; color: string; drivers: Map<string, { name: string; slug: string; starts: number }>; engines: Set<string> }>();
  for (const race of season.races) {
    for (const r of race.results) {
      if (r.isSprint) continue;
      const t = teams.get(r.constructorId) ?? { id: r.constructorId, name: r.team.name, slug: r.team.slug, color: r.team.color, drivers: new Map(), engines: new Set<string>() };
      const d = t.drivers.get(r.driverId) ?? { name: r.driver.fullName, slug: r.driver.slug, starts: 0 };
      d.starts++;
      t.drivers.set(r.driverId, d);
      if (r.engine) t.engines.add(r.engine);
      teams.set(r.constructorId, t);
    }
  }
  const order = new Map(season.constructorStandings.map((c, i) => [c.constructorId, i]));
  return [...teams.values()].sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99) || a.name.localeCompare(b.name));
}
