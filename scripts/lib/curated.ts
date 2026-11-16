/** Loads hand-curated data (eras, lineage, cars, layouts, glossary, regulations). */
import type { PrismaClient } from "@prisma/client";
import { ERAS, eraForYear } from "../../data/curated/eras";
import { GLOSSARY } from "../../data/curated/glossary";
import { LINEAGE } from "../../data/curated/teams";
import { CHASSIS, ENGINES } from "../../data/curated/cars";
import { CIRCUIT_LAYOUTS } from "../../data/curated/circuits";
import { REGULATION_CHANGES } from "../../data/curated/seasons";
import { maxPointsPerWeekend } from "./ingest";

export async function ingestEras(prisma: PrismaClient) {
  for (const [i, e] of ERAS.entries()) {
    const data = { ...e, order: i };
    await prisma.era.upsert({ where: { slug: e.slug }, create: data, update: data });
  }
}

export async function ingestGlossary(prisma: PrismaClient) {
  for (const g of GLOSSARY) {
    await prisma.glossaryTerm.upsert({ where: { slug: g.slug }, create: g, update: g });
  }
}

export async function ingestCurated(prisma: PrismaClient) {
  await ingestEras(prisma);
  await ingestGlossary(prisma);

  const teamIds = new Set((await prisma.team.findMany({ select: { id: true } })).map((c) => c.id));
  let edges = 0;
  for (const l of LINEAGE) {
    if (!teamIds.has(l.from) || !teamIds.has(l.to)) {
      console.warn(`  lineage skipped (unknown id): ${l.from} → ${l.to}`);
      continue;
    }
    const data = { year: l.year, kind: l.kind, note: l.note ?? null };
    await prisma.constructorLineage.upsert({
      where: { predecessorId_successorId: { predecessorId: l.from, successorId: l.to } },
      create: { predecessorId: l.from, successorId: l.to, ...data },
      update: data,
    });
    edges++;
  }
  console.log(`  lineage edges: ${edges}`);

  for (const [id, e] of Object.entries(ENGINES)) {
    await prisma.engine.upsert({ where: { id }, create: { id, ...e }, update: e });
  }
  const years = new Set((await prisma.season.findMany({ select: { year: true } })).map((s) => s.year));
  let cars = 0;
  for (const c of CHASSIS) {
    if (!teamIds.has(c.constructorId) || !years.has(c.year)) {
      console.warn(`  chassis skipped: ${c.id}`);
      continue;
    }
    const data = { name: c.name, constructorId: c.constructorId, year: c.year, engineId: c.engineId, designer: c.designer ?? null, notes: c.notes ?? null };
    await prisma.chassis.upsert({ where: { id: c.id }, create: { id: c.id, ...data }, update: data });
    cars++;
  }
  console.log(`  chassis: ${cars}`);

  const circuitIds = new Set((await prisma.circuit.findMany({ select: { id: true } })).map((c) => c.id));
  for (const [circuitId, layouts] of Object.entries(CIRCUIT_LAYOUTS)) {
    if (!circuitIds.has(circuitId)) continue;
    for (const l of layouts) {
      const data = { name: l.name, toYear: l.toYear, lengthKm: l.lengthKm ?? null, notes: l.notes };
      await prisma.circuitLayout.upsert({
        where: { circuitId_fromYear: { circuitId, fromYear: l.fromYear } },
        create: { circuitId, fromYear: l.fromYear, ...data },
        update: data,
      });
    }
  }

  for (const year of years) {
    await prisma.season.update({
      where: { year },
      data: { eraSlug: eraForYear(year), regulationChanges: REGULATION_CHANGES[year] ?? [] },
    });
  }
}

/**
 * The race after which the drivers' title could no longer be lost: replay the season
 * round by round (race + sprint points) and compare the leader's margin with the most
 * points still available (2010+ points system).
 */
export async function clinchRound(prisma: PrismaClient, year: number): Promise<{ race: string; left: number } | null> {
  const races = await prisma.race.findMany({ where: { year }, orderBy: { round: "asc" }, include: { results: { select: { driverId: true, points: true } } } });
  const totals = new Map<string, number>();
  for (const [i, race] of races.entries()) {
    if (!race.winnerDriverId) break;
    for (const r of race.results) totals.set(r.driverId, (totals.get(r.driverId) ?? 0) + r.points);
    const rest = races.slice(i + 1);
    const maxLeft = rest.reduce((sum, r) => sum + maxPointsPerWeekend(year, r.hasSprint).driver, 0);
    const [first, second] = [...totals.values()].sort((a, b) => b - a);
    if (rest.length && first - (second ?? 0) > maxLeft) return { race: race.name, left: rest.length };
  }
  return null;
}

/** Data-driven one-line headline for each season (overwritten only when empty). */
export async function buildSeasonHeadlines(prisma: PrismaClient) {
  const seasons = await prisma.season.findMany({
    include: { championDriver: true, championConstructor: true, races: { select: { winnerDriverId: true } } },
  });
  for (const s of seasons) {
    if (!s.headlineAuto) continue;
    let headline: string;
    if (s.championDriver) {
      const standing = await prisma.driverStanding.findMany({ where: { year: s.year }, orderBy: { position: "asc" }, take: 2, include: { driver: true } });
      const margin = standing.length === 2 ? standing[0].points - standing[1].points : null;
      const wins = standing[0]?.wins ?? 0;
      const roundsLeft = s.races.filter((r) => !r.winnerDriverId).length;
      const clinch = roundsLeft > 0 ? await clinchRound(prisma, s.year) : null;
      headline = clinch
        ? `${s.championDriver.fullName} clinches the title at the ${clinch.race}, with ${clinch.left} round${clinch.left === 1 ? "" : "s"} to spare`
        : margin !== null && margin <= 3
          ? `${s.championDriver.fullName} edges ${standing[1].driver.fullName} by ${margin} point${margin === 1 ? "" : "s"}`
          : `${s.championDriver.fullName} takes the title with ${wins} win${wins === 1 ? "" : "s"}`;
    } else {
      const done = s.races.filter((r) => r.winnerDriverId).length;
      headline = `Season in progress: ${done} of ${s.rounds} rounds completed`;
    }
    await prisma.season.update({ where: { year: s.year }, data: { headline } });
  }
}
