import { cache } from "react";
import { prisma } from "./db";

export const getDriver = cache((slug: string) =>
  prisma.driver.findUnique({ where: { slug }, include: { image: true, standings: { orderBy: { year: "asc" } } } }),
);

export interface TeammateH2H {
  slug: string;
  name: string;
  races: number;
  raceAhead: number;
  raceBehind: number;
  qualiAhead: number;
  qualiBehind: number;
  years: string;
}

/** Head-to-head vs every teammate (same constructor, same Grand Prix). */
export async function teammateHeadToHead(driverId: string): Promise<TeammateH2H[]> {
  const mine = await prisma.result.findMany({
    where: { driverId, isSprint: false },
    select: { raceId: true, constructorId: true, positionOrder: true, grid: true, positionText: true },
  });
  if (!mine.length) return [];
  const others = await prisma.result.findMany({
    where: { raceId: { in: mine.map((m) => m.raceId) }, isSprint: false, driverId: { not: driverId } },
    select: { raceId: true, constructorId: true, positionOrder: true, grid: true, positionText: true, driver: { select: { slug: true, fullName: true } } },
  });
  const byRace = new Map(mine.map((m) => [`${m.raceId}|${m.constructorId}`, m]));
  const agg = new Map<string, TeammateH2H & { yearSet: Set<number> }>();
  const started = (t: string) => !["F", "W", "EX"].includes(t);
  for (const o of others) {
    const me = byRace.get(`${o.raceId}|${o.constructorId}`);
    if (!me || !started(me.positionText) || !started(o.positionText)) continue;
    const a = agg.get(o.driver.slug) ?? { slug: o.driver.slug, name: o.driver.fullName, races: 0, raceAhead: 0, raceBehind: 0, qualiAhead: 0, qualiBehind: 0, years: "", yearSet: new Set<number>() };
    a.races++;
    a.yearSet.add(Number(o.raceId.split("-")[0]));
    if (me.positionOrder < o.positionOrder) a.raceAhead++;
    else a.raceBehind++;
    if (me.grid && o.grid) {
      if (me.grid < o.grid) a.qualiAhead++;
      else if (me.grid > o.grid) a.qualiBehind++;
    }
    agg.set(o.driver.slug, a);
  }
  return [...agg.values()]
    .map(({ yearSet, ...a }) => {
      const ys = [...yearSet].sort();
      return { ...a, years: ys[0] === ys.at(-1) ? String(ys[0]) : `${ys[0]}–${ys.at(-1)}` };
    })
    .sort((x, y) => y.races - x.races);
}

export async function teamsOf(driverId: string) {
  return prisma.$queryRaw<{ slug: string; name: string; color: string; first: number; last: number; starts: number; wins: number }[]>`
    SELECT c.slug, c.name, c.color, MIN(ra.year)::int AS first, MAX(ra.year)::int AS last,
           COUNT(DISTINCT r."raceId")::int AS starts, COUNT(*) FILTER (WHERE r.position = 1)::int AS wins
    FROM "Result" r JOIN "Race" ra ON ra.id = r."raceId" JOIN "Constructor" c ON c.id = r."constructorId"
    WHERE r."driverId" = ${driverId} AND r."isSprint" = false
    GROUP BY c.slug, c.name, c.color ORDER BY first`;
}

export async function notableRaces(driverId: string) {
  const [first, wins, podiumFirst] = await Promise.all([
    prisma.result.findFirst({ where: { driverId, isSprint: false }, orderBy: { race: { date: "asc" } }, include: { race: true, team: true } }),
    prisma.race.findMany({ where: { winnerDriverId: driverId }, orderBy: { date: "asc" }, include: { winnerTeam: true, circuit: true } }),
    prisma.result.findFirst({ where: { driverId, isSprint: false, position: { lte: 3 } }, orderBy: { race: { date: "asc" } }, include: { race: true } }),
  ]);
  return { first, wins, podiumFirst };
}
