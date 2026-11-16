/**
 * Plain-text "fact sheets" built from the structured archive. They are the single
 * source of grounding for (a) AI article generation, (b) RAG chunks and
 * (c) the template articles used when no LLM key is configured.
 */
import type { PrismaClient } from "@prisma/client";
import { formatDate, formatPoints, ordinal } from "./text";
import { TEAM_NOTES } from "../../data/curated/teams";
import { clinchRound } from "../../scripts/lib/curated";

export interface FactSheet {
  type: "SEASON" | "DRIVER" | "TEAM" | "CIRCUIT" | "ERA" | "RACE" | "GLOSSARY";
  id: string;
  title: string;
  url: string;
  facts: string[]; // one fact per line, self-contained
}

export async function seasonFacts(db: PrismaClient, year: number): Promise<FactSheet | null> {
  const s = await db.season.findUnique({
    where: { year },
    include: {
      championDriver: true,
      championConstructor: true,
      era: true,
      races: { orderBy: { round: "asc" }, include: { circuit: true, winner: true, winnerTeam: true, pole: true } },
      driverStandings: { orderBy: { position: "asc" }, take: 6, include: { driver: true } },
      constructorStandings: { orderBy: { position: "asc" }, take: 5, include: { team: true } },
    },
  });
  if (!s) return null;
  const f: string[] = [];
  f.push(`The ${year} Formula One World Championship had ${s.rounds} rounds${s.era ? ` and belongs to the ${s.era.name} era (${s.era.startYear}–${s.era.endYear ?? "present"})` : ""}.`);
  const left = s.races.filter((r) => !r.winnerDriverId).length;
  const clinch = left && s.championDriver ? await clinchRound(db, year) : null;
  const decided = clinch ? ` (clinched mathematically at the ${clinch.race}, with ${clinch.left} round${clinch.left === 1 ? "" : "s"} still to run)` : "";
  if (left) f.push(`The ${year} season is still in progress: ${s.races.length - left} of ${s.races.length} rounds completed.`);
  if (s.championDriver) f.push(`${s.championDriver.fullName} won the ${year} Drivers' Championship${decided}.`);
  if (s.championConstructor) f.push(`${s.championConstructor.name} won the ${year} Constructors' Championship${decided}.`);
  if (year < 1958) f.push(`There was no Constructors' Championship in ${year}; it was introduced in 1958.`);
  if (s.driverStandings.length) {
    f.push(
      `${year} final drivers' standings top six: ` +
        s.driverStandings.map((d) => `${d.positionText}. ${d.driver.fullName} ${formatPoints(d.points)} pts (${d.wins} wins)`).join("; ") + ".",
    );
  }
  if (s.constructorStandings.length) {
    f.push(`${year} constructors' standings: ` + s.constructorStandings.map((c) => `${c.positionText}. ${c.team.name} ${formatPoints(c.points)} pts`).join("; ") + ".");
  }
  const winsBy = new Map<string, number>();
  for (const r of s.races) if (r.winner) winsBy.set(r.winner.fullName, (winsBy.get(r.winner.fullName) ?? 0) + 1);
  if (winsBy.size) f.push(`${year} race winners: ${[...winsBy].sort((a, b) => b[1] - a[1]).map(([n, w]) => `${n} (${w})`).join(", ")}.`);
  for (const r of s.races) {
    f.push(
      `${year} round ${r.round}: ${r.name} at ${r.circuit.name}, ${r.circuit.country ?? ""} on ${formatDate(r.date)}` +
        (r.winner ? ` — won by ${r.winner.fullName} (${r.winnerTeam?.name ?? ""})` : " — not yet run") +
        (r.pole ? `; pole: ${r.pole.fullName}` : "") + ".",
    );
  }
  if (s.regulationChanges.length) f.push(`Rule changes in ${year}: ${s.regulationChanges.join("; ")}.`);
  return { type: "SEASON", id: String(year), title: `${year} season`, url: `/seasons/${year}`, facts: f };
}

export async function driverFacts(db: PrismaClient, id: string): Promise<FactSheet | null> {
  const d = await db.driver.findUnique({ where: { id }, include: { standings: { orderBy: { year: "asc" } } } });
  if (!d) return null;
  const teams = await db.result.groupBy({ by: ["constructorId"], where: { driverId: id, isSprint: false }, _count: true });
  const teamRows = await db.team.findMany({ where: { id: { in: teams.map((t) => t.constructorId) } } });
  const teamYears = await db.$queryRaw<{ constructorId: string; first: number; last: number }[]>`
    SELECT r."constructorId", MIN(ra.year)::int AS first, MAX(ra.year)::int AS last
    FROM "Result" r JOIN "Race" ra ON ra.id = r."raceId" WHERE r."driverId" = ${id} AND r."isSprint" = false
    GROUP BY r."constructorId" ORDER BY first`;
  const wins = await db.race.findMany({ where: { winnerDriverId: id }, orderBy: { date: "asc" }, include: { circuit: true } });
  const f: string[] = [];
  f.push(
    `${d.fullName} is a ${d.nationality ?? ""} racing driver${d.dateOfBirth ? `, born ${formatDate(d.dateOfBirth)}` : ""}${d.dateOfDeath ? `, died ${formatDate(d.dateOfDeath)}` : ""}.`,
  );
  if (d.firstYear) f.push(`${d.fullName} competed in Formula One World Championship races from ${d.firstYear} to ${d.lastYear}.`);
  f.push(
    `${d.fullName} career statistics: ${d.starts} starts, ${d.wins} wins, ${d.poles} pole positions, ${d.podiums} podiums, ${d.fastestLaps} fastest laps (recorded from 2004 onwards), ${formatPoints(d.points)} career points, ${d.titles} World Championship title${d.titles === 1 ? "" : "s"}.`,
  );
  const titleYears = d.standings.filter((s) => s.position === 1).map((s) => s.year);
  if (d.titles) f.push(`${d.fullName} was World Champion in ${titleYears.join(", ")}.`);
  if (teamYears.length) {
    f.push(
      `${d.fullName} drove for: ` +
        teamYears.map((t) => `${teamRows.find((c) => c.id === t.constructorId)?.name ?? t.constructorId} (${t.first === t.last ? t.first : `${t.first}–${t.last}`})`).join(", ") + ".",
    );
  }
  if (d.standings.length) {
    f.push(`${d.fullName} championship finishes by season: ` + d.standings.map((s) => `${s.year} ${s.positionText === "-" ? "unclassified" : ordinal(Number(s.positionText) || 0)} (${formatPoints(s.points)} pts)`).join(", ") + ".");
  }
  if (wins.length) {
    f.push(`${d.fullName} first win: ${wins[0].year} ${wins[0].name}. Last win: ${wins.at(-1)!.year} ${wins.at(-1)!.name}.`);
    if (wins.length <= 40) f.push(`${d.fullName} Grand Prix wins: ${wins.map((w) => `${w.year} ${w.name}`).join("; ")}.`);
  }
  if (d.numbers.length) f.push(`${d.fullName} raced with car number(s) ${d.numbers.join(", ")}.`);
  return { type: "DRIVER", id, title: d.fullName, url: `/drivers/${d.slug}`, facts: f };
}

export async function teamFacts(db: PrismaClient, id: string): Promise<FactSheet | null> {
  const c = await db.team.findUnique({
    where: { id },
    include: {
      standings: { orderBy: { year: "asc" } },
      predecessorOf: { include: { successor: true } },
      successorOf: { include: { predecessor: true } },
      chassis: { orderBy: { year: "asc" }, include: { engine: true } },
    },
  });
  if (!c) return null;
  const f: string[] = [];
  f.push(
    `${c.name} is a ${c.nationality ?? ""} Formula One constructor` +
      (c.founded ? ` founded in ${c.founded}` : "") + (c.founder ? ` by ${c.founder}` : "") + (c.base ? `, based in ${c.base}` : "") + ".",
  );
  if (c.firstYear) f.push(`${c.name} raced in the World Championship from ${c.firstYear} to ${c.lastYear}. Status: ${c.status.replace(/_/g, " ").toLowerCase()}.`);
  f.push(
    `${c.name} statistics: ${c.entries} race entries, ${c.wins} wins, ${c.poles} poles, ${c.podiums} podium finishes, ${c.constructorTitles} Constructors' titles, ${c.driverTitles} Drivers' titles won by its drivers.`,
  );
  const titleYears = c.standings.filter((s) => s.position === 1).map((s) => s.year);
  if (titleYears.length) f.push(`${c.name} won the Constructors' Championship in ${titleYears.join(", ")}.`);
  for (const l of c.successorOf) f.push(`${c.name} succeeded ${l.predecessor.name} in ${l.year} (${l.kind}${l.note ? `: ${l.note}` : ""}).`);
  for (const l of c.predecessorOf) f.push(`${c.name} became ${l.successor.name} in ${l.year} (${l.kind}${l.note ? `: ${l.note}` : ""}).`);
  if (c.whyDisappeared) f.push(`What happened to ${c.name}: ${c.whyDisappeared}`);
  // Seasons in which every one of the team's results was disqualified (e.g. Tyrrell 1984).
  const excluded = await db.$queryRaw<{ year: number }[]>`
    SELECT ra.year FROM "Result" r JOIN "Race" ra ON ra.id = r."raceId"
    WHERE r."constructorId" = ${id} AND r."isSprint" = false
    GROUP BY ra.year HAVING COUNT(*) > 1 AND bool_and(r.status = 'Disqualified')`;
  for (const e of excluded) f.push(`In ${e.year} all of ${c.name}'s race results were disqualified and the team scored no championship points.`);
  for (const note of TEAM_NOTES[id] ?? []) f.push(note);
  if (c.standings.length) f.push(`${c.name} constructors' championship positions: ` + c.standings.map((s) => `${s.year} ${s.positionText}`).join(", ") + ".");
  const drivers = await db.$queryRaw<{ fullName: string; first: number; last: number; starts: number }[]>`
    SELECT d."fullName", MIN(ra.year)::int AS first, MAX(ra.year)::int AS last, COUNT(*)::int AS starts
    FROM "Result" r JOIN "Race" ra ON ra.id = r."raceId" JOIN "Driver" d ON d.id = r."driverId"
    WHERE r."constructorId" = ${id} AND r."isSprint" = false
    GROUP BY d."fullName" ORDER BY starts DESC LIMIT 40`;
  if (drivers.length) f.push(`Drivers who raced for ${c.name} (most entries first): ${drivers.map((d) => `${d.fullName} (${d.first}–${d.last})`).join(", ")}.`);
  for (const ch of c.chassis) f.push(`${c.name} ${ch.year} car: ${ch.name}${ch.engine ? `, ${ch.engine.manufacturer} ${ch.engine.configuration}` : ""}${ch.designer ? `, designed by ${ch.designer}` : ""}.${ch.notes ? ` ${ch.notes}` : ""}`);
  const entries = await db.teamSeason.findMany({ where: { teamId: id }, orderBy: { year: "asc" } });
  if (entries.length) f.push(`${c.name} chassis and engines by season: ` + entries.map((e) => `${e.year} ${e.chassis.join("/") || "?"}${e.engines.length ? ` (${e.engines.join("; ")})` : ""}`).join("; ") + ".");
  return { type: "TEAM", id, title: c.name, url: `/teams/${c.slug}`, facts: f };
}

export async function circuitFacts(db: PrismaClient, id: string): Promise<FactSheet | null> {
  const c = await db.circuit.findUnique({ where: { id }, include: { layouts: { orderBy: { fromYear: "asc" } } } });
  if (!c) return null;
  const races = await db.race.findMany({ where: { circuitId: id }, orderBy: { date: "asc" }, include: { winner: true } });
  const f: string[] = [];
  f.push(`${c.name} is a ${c.type.toLowerCase()} circuit in ${c.locality ?? ""}, ${c.country ?? ""}.`);
  if (c.firstYear) f.push(`${c.name} hosted ${c.raceCount} World Championship Grands Prix between ${c.firstYear} and ${c.lastYear}.`);
  if (c.lengthKm) f.push(`The current ${c.name} layout is ${c.lengthKm} km long with ${c.turns ?? "?"} turns.`);
  if (c.lapRecord) f.push(`Fastest race lap at ${c.name} in the archive (data from 2004): ${c.lapRecord}.`);
  for (const l of c.layouts) f.push(`${c.name} layout "${l.name}" (${l.fromYear}–${l.toYear ?? "present"}${l.lengthKm ? `, ${l.lengthKm} km` : ""}): ${l.notes ?? ""}`);
  const wins = new Map<string, number>();
  for (const r of races) if (r.winner) wins.set(r.winner.fullName, (wins.get(r.winner.fullName) ?? 0) + 1);
  const top = [...wins].sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (top.length) f.push(`Most successful drivers at ${c.name}: ${top.map(([n, w]) => `${n} (${w} wins)`).join(", ")}.`);
  if (races.length) f.push(`Grands Prix at ${c.name}: ${races.map((r) => `${r.year} ${r.name} (${r.winner?.fullName ?? "TBD"})`).join("; ")}.`);
  return { type: "CIRCUIT", id, title: c.name, url: `/circuits/${c.slug}`, facts: f };
}

export function factsToText(sheet: FactSheet): string {
  return sheet.facts.map((x) => `- ${x}`).join("\n");
}
