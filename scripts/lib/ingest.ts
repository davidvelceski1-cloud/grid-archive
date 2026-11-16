/**
 * Turns cached Jolpica data into GRID ARCHIVE rows. Every function is
 * idempotent: reference rows are upserted and a season's races are replaced
 * wholesale, so re-running (or the post-race update job) is always safe.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { canonicalConstructor, NATIONAL_COLOURS, SLUG_OVERRIDES, SYNTHETIC_CONSTRUCTORS, TEAM_META } from "../../data/curated/teams";
import { CIRCUIT_SPECS, CIRCUIT_TYPE } from "../../data/curated/circuits";
import { searchKey, slugify } from "../../src/lib/text";
import { jolpica, type JRace, type JResult } from "./jolpica";
import { titleFromUrl } from "./wiki";

const NOT_STARTED = new Set(["F", "W", "EX"]);

function int(v: string | undefined | null): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

export async function ingestReference(prisma: PrismaClient) {
  const [drivers, constructors, circuits] = await Promise.all([
    jolpica.drivers(),
    jolpica.constructors(),
    jolpica.circuits(),
  ]);

  // Drivers
  const usedSlugs = new Set<string>();
  for (const d of drivers) {
    // Prefer the Wikipedia article title ("Juan Manuel Fangio") over given+family ("Juan Fangio").
    const wikiName = titleFromUrl(d.url)?.replace(/\s*\(.*\)\s*$/, "");
    const fullName =
      wikiName && searchKey(wikiName).includes(searchKey(d.familyName)) && wikiName.split(" ").length <= 5
        ? wikiName
        : `${d.givenName} ${d.familyName}`;
    let slug = slugify(fullName);
    if (usedSlugs.has(slug)) slug = `${slug}-${d.dateOfBirth?.slice(0, 4) ?? d.driverId}`;
    usedSlugs.add(slug);
    const data = {
      slug,
      code: d.code ?? null,
      permanentNumber: d.permanentNumber ?? null,
      givenName: d.givenName,
      familyName: d.familyName,
      fullName,
      searchName: searchKey(`${fullName} ${d.code ?? ""}`),
      dateOfBirth: d.dateOfBirth ? new Date(`${d.dateOfBirth}T00:00:00Z`) : null,
      nationality: d.nationality ?? null,
      url: d.url ?? null,
    };
    await prisma.driver.upsert({ where: { id: d.driverId }, create: { id: d.driverId, ...data }, update: data });
  }
  console.log(`  drivers: ${drivers.length}`);

  // Constructors (canonicalised: "cooper-climax" → "cooper")
  const canon = new Map<string, { name: string; nationality?: string; url?: string }>();
  for (const c of constructors) {
    const { id } = canonicalConstructor(c.constructorId);
    if (id === c.constructorId) canon.set(id, { name: c.name, nationality: c.nationality, url: c.url });
    else if (!canon.has(id)) {
      const synthetic = SYNTHETIC_CONSTRUCTORS[id];
      canon.set(id, {
        name: synthetic?.name ?? c.name.split("-")[0],
        nationality: synthetic?.nationality ?? c.nationality,
        url: c.url,
      });
    }
  }
  for (const [id, c] of canon) {
    const meta = TEAM_META[id] ?? {};
    const slug = SLUG_OVERRIDES[id] ?? slugify(id.replace(/_/g, " "));
    const base = {
      slug,
      name: c.name,
      searchName: searchKey(c.name),
      nationality: c.nationality ?? null,
      url: c.url ?? null,
    };
    // Curated fields only fill blanks on update so /admin edits survive re-ingestion.
    const existing = await prisma.team.findUnique({ where: { id } });
    await prisma.team.upsert({
      where: { id },
      create: {
        id,
        ...base,
        color: meta.color ?? NATIONAL_COLOURS[c.nationality ?? ""] ?? "#5A5F66",
        founded: meta.founded ?? null,
        base: meta.base ?? null,
        founder: meta.founder ?? null,
        whyDisappeared: meta.whyDisappeared ?? null,
      },
      update: {
        ...base,
        founded: existing?.founded ?? meta.founded ?? null,
        base: existing?.base ?? meta.base ?? null,
        founder: existing?.founder ?? meta.founder ?? null,
        whyDisappeared: existing?.whyDisappeared ?? meta.whyDisappeared ?? null,
      },
    });
  }
  console.log(`  constructors: ${canon.size} (from ${constructors.length} Jolpica ids)`);

  // Circuits
  for (const c of circuits) {
    const data = {
      slug: slugify(c.circuitId.replace(/_/g, " ")),
      name: c.circuitName,
      searchName: searchKey(`${c.circuitName} ${c.Location?.locality ?? ""} ${c.Location?.country ?? ""}`),
      locality: c.Location?.locality ?? null,
      country: c.Location?.country ?? null,
      lat: c.Location?.lat ? Number(c.Location.lat) : null,
      lng: c.Location?.long ? Number(c.Location.long) : null,
      url: c.url ?? null,
      type: CIRCUIT_TYPE[c.circuitId] ?? "PERMANENT",
      lengthKm: CIRCUIT_SPECS[c.circuitId]?.lengthKm ?? null,
      turns: CIRCUIT_SPECS[c.circuitId]?.turns ?? null,
    };
    await prisma.circuit.upsert({ where: { id: c.circuitId }, create: { id: c.circuitId, ...data }, update: data });
  }
  console.log(`  circuits: ${circuits.length}`);
}

function mapResult(raceId: string, r: JResult, isSprint: boolean) {
  const { id: constructorId, engine } = canonicalConstructor(r.Constructor.constructorId);
  return {
    raceId,
    driverId: r.Driver.driverId,
    constructorId,
    engine,
    isSprint,
    number: r.number ?? null,
    grid: int(r.grid),
    position: int(r.position),
    positionText: r.positionText,
    positionOrder: int(r.position) ?? 0,
    points: Number(r.points ?? 0),
    laps: int(r.laps) ?? 0,
    status: r.status ?? "",
    timeText: r.Time?.time ?? null,
    timeMillis: r.Time?.millis ? BigInt(r.Time.millis) : null,
    fastestLapRank: int(r.FastestLap?.rank),
    fastestLapTime: r.FastestLap?.Time?.time ?? null,
  };
}

/** Replace one season's races, results, qualifying and final standings. */
export async function ingestSeason(prisma: PrismaClient, year: number, fresh = false) {
  const [schedule, results, sprints, qualifying, dStand, cStand] = await Promise.all([
    jolpica.schedule(year, fresh),
    jolpica.results(year, fresh),
    jolpica.sprints(year, fresh),
    jolpica.qualifying(year, fresh),
    jolpica.driverStandings(year, fresh),
    jolpica.constructorStandings(year, fresh),
  ]);

  const byRound = (rs: JRace[]) => new Map(rs.map((r) => [r.round, r]));
  const resMap = byRound(results);
  const sprintMap = byRound(sprints);
  const qMap = byRound(qualifying);

  const raceRows: Prisma.RaceCreateManyInput[] = [];
  const resultRows: ReturnType<typeof mapResult>[] = [];
  const qualiRows: Prisma.QualifyingCreateManyInput[] = [];
  const slugs = new Set<string>();

  for (const race of schedule) {
    const raceId = `${year}-${race.round}`;
    let slug = slugify(race.raceName);
    if (slugs.has(slug)) slug = `${slug}-${race.round}`;
    slugs.add(slug);

    const res = resMap.get(race.round)?.Results ?? [];
    const sprint = sprintMap.get(race.round)?.SprintResults ?? [];
    const quali = qMap.get(race.round)?.QualifyingResults ?? [];

    // Result positionOrder: Jolpica lists results in classification order.
    const mapped = res.map((r, i) => ({ ...mapResult(raceId, r, false), positionOrder: i + 1 }));
    const mappedSprint = sprint.map((r, i) => ({ ...mapResult(raceId, r, true), positionOrder: i + 1 }));
    resultRows.push(...mapped, ...mappedSprint);

    const winner = mapped.find((r) => r.position === 1);
    const pole =
      quali.find((q) => q.position === "1")?.Driver.driverId ?? mapped.find((r) => r.grid === 1)?.driverId ?? null;
    const fl = mapped.find((r) => r.fastestLapRank === 1)?.driverId ?? null;

    raceRows.push({
      id: raceId,
      year,
      round: Number(race.round),
      name: race.raceName,
      slug,
      date: new Date(`${race.date}T${race.time ?? "12:00:00Z"}`),
      time: race.time ?? null,
      url: race.url ?? null,
      circuitId: race.Circuit.circuitId,
      winnerDriverId: winner?.driverId ?? null,
      winnerConstructorId: winner?.constructorId ?? null,
      poleDriverId: pole,
      fastestLapDriverId: fl,
      hasSprint: mappedSprint.length > 0 || Boolean(race.Sprint),
    });

    for (const q of quali) {
      qualiRows.push({
        raceId,
        driverId: q.Driver.driverId,
        constructorId: canonicalConstructor(q.Constructor.constructorId).id,
        number: q.number ?? null,
        position: Number(q.position),
        q1: q.Q1 ?? null,
        q2: q.Q2 ?? null,
        q3: q.Q3 ?? null,
      });
    }
  }

  // Constructor standings: canonicalise and merge duplicate ids (e.g. two Cooper engine variants).
  const cMerged = new Map<string, { points: number; wins: number; position: number | null; positionText: string }>();
  for (const s of cStand) {
    const id = canonicalConstructor(s.Constructor.constructorId).id;
    const prev = cMerged.get(id);
    const pos = int(s.position);
    if (!prev) cMerged.set(id, { points: Number(s.points), wins: Number(s.wins), position: pos, positionText: s.positionText });
    else {
      prev.points += Number(s.points);
      prev.wins += Number(s.wins);
      if (pos !== null && (prev.position === null || pos < prev.position)) {
        prev.position = pos;
        prev.positionText = s.positionText;
      }
    }
  }

  const resultIds = <T extends { raceId: string; driverId: string; isSprint: boolean; positionOrder: number }>(rows: T[]): T[] => {
    // Guard against rare duplicate keys in source data.
    const seen = new Set<string>();
    return rows.filter((r) => {
      const k = `${r.raceId}|${r.driverId}|${r.isSprint}|${r.positionOrder}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };
  const seenQ = new Set<string>();
  const qualiUnique = qualiRows.filter((q) => {
    const k = `${q.raceId}|${q.driverId}`;
    if (seenQ.has(k)) return false;
    seenQ.add(k);
    return true;
  });

  await prisma.$transaction(
    async (tx) => {
      await tx.season.upsert({
        where: { year },
        create: { year, rounds: schedule.length },
        update: { rounds: schedule.length },
      });
      await tx.race.deleteMany({ where: { year } }); // cascades results + qualifying
      await tx.driverStanding.deleteMany({ where: { year } });
      await tx.constructorStanding.deleteMany({ where: { year } });
      await tx.race.createMany({ data: raceRows });
      await tx.result.createMany({ data: resultIds(resultRows) });
      if (qualiUnique.length) await tx.qualifying.createMany({ data: qualiUnique });
      await tx.driverStanding.createMany({
        data: dStand.map((s) => ({
          year,
          driverId: s.Driver.driverId,
          position: int(s.position),
          positionText: s.positionText,
          points: Number(s.points),
          wins: Number(s.wins),
          constructorIds: [...new Set(s.Constructors.map((c) => canonicalConstructor(c.constructorId).id))],
        })),
        skipDuplicates: true,
      });
      await tx.constructorStanding.createMany({
        data: [...cMerged].map(([constructorId, s]) => ({ year, constructorId, ...s })),
      });
    },
    { timeout: 120_000 },
  );
  return { races: raceRows.length, results: resultRows.length };
}

/** A season counts as complete when every scheduled round has race results. */
export async function isSeasonComplete(prisma: PrismaClient, year: number) {
  const races = await prisma.race.findMany({ where: { year }, select: { winnerDriverId: true, date: true } });
  return races.length > 0 && races.every((r) => r.winnerDriverId !== null);
}

/** Maximum points one driver / one team can still score per remaining race weekend. */
export function maxPointsPerWeekend(year: number, sprint: boolean) {
  const fastestLap = year >= 2019 && year <= 2024 ? 1 : 0;
  return {
    driver: 25 + fastestLap + (sprint ? 8 : 0),
    constructor: 25 + 18 + fastestLap + (sprint ? 8 + 7 : 0),
  };
}

/**
 * For an unfinished season (2010+ points system), a title is decided once the
 * leader's margin exceeds the most points the runner-up could still score.
 */
export async function clinchedTitles(prisma: PrismaClient, year: number) {
  if (year < 2010) return { driver: false, constructor: false, roundsLeft: 0 };
  const left = await prisma.race.findMany({ where: { year, winnerDriverId: null }, select: { hasSprint: true } });
  const max = left.reduce(
    (acc, r) => {
      const m = maxPointsPerWeekend(year, r.hasSprint);
      return { driver: acc.driver + m.driver, constructor: acc.constructor + m.constructor };
    },
    { driver: 0, constructor: 0 },
  );
  const [d1, d2] = await prisma.driverStanding.findMany({ where: { year }, orderBy: { points: "desc" }, take: 2 });
  const [c1, c2] = await prisma.constructorStanding.findMany({ where: { year }, orderBy: { points: "desc" }, take: 2 });
  return {
    driver: Boolean(d1 && d2 && d1.points - d2.points > max.driver),
    constructor: Boolean(c1 && c2 && c1.points - c2.points > max.constructor),
    roundsLeft: left.length,
  };
}

/** Recompute champions, career stats and circuit stats from the stored results. */
export async function recomputeStats(prisma: PrismaClient) {
  const seasons = await prisma.season.findMany({ select: { year: true } });
  const latestYear = Math.max(...seasons.map((s) => s.year));

  // Season champions: completed seasons, or titles already mathematically clinched.
  for (const { year } of seasons) {
    const complete = year < latestYear || (await isSeasonComplete(prisma, year));
    const clinch = complete ? null : await clinchedTitles(prisma, year);
    const d = complete || clinch?.driver ? await prisma.driverStanding.findFirst({ where: { year }, orderBy: { points: "desc" } }) : null;
    const c = complete || clinch?.constructor ? await prisma.constructorStanding.findFirst({ where: { year }, orderBy: { points: "desc" } }) : null;
    await prisma.season.update({
      where: { year },
      data: { championDriverId: d?.driverId ?? null, championConstructorId: c?.constructorId ?? null },
    });
  }

  const results = await prisma.result.findMany({
    select: {
      raceId: true, driverId: true, constructorId: true, isSprint: true, position: true,
      positionText: true, grid: true, points: true, fastestLapRank: true, number: true,
    },
  });
  const quali = await prisma.qualifying.findMany({ where: { position: 1 }, select: { raceId: true, driverId: true, constructorId: true } });
  const champs = await prisma.season.findMany({ select: { year: true, championDriverId: true, championConstructorId: true } });
  const finalStandings = await prisma.driverStanding.findMany({ where: { position: 1 }, select: { year: true, driverId: true, constructorIds: true } });

  type Agg = { starts: number; wins: number; poles: number; podiums: number; fl: number; points: number; years: Set<number>; races: Set<string>; numbers: Set<string> };
  const blank = (): Agg => ({ starts: 0, wins: 0, poles: 0, podiums: 0, fl: 0, points: 0, years: new Set(), races: new Set(), numbers: new Set() });
  const dAgg = new Map<string, Agg>();
  const cAgg = new Map<string, Agg>();
  const get = (m: Map<string, Agg>, k: string) => m.get(k) ?? (m.set(k, blank()), m.get(k)!);

  const poleByRace = new Map<string, { driverId: string; constructorId: string }>();
  for (const q of quali) poleByRace.set(q.raceId, q);
  for (const r of results) {
    if (!r.isSprint && r.grid === 1 && !poleByRace.has(r.raceId)) poleByRace.set(r.raceId, r);
  }

  for (const r of results) {
    const year = Number(r.raceId.split("-")[0]);
    const d = get(dAgg, r.driverId);
    const c = get(cAgg, r.constructorId);
    d.points += r.points;
    c.points += r.points;
    if (r.isSprint) continue;
    d.years.add(year);
    c.years.add(year);
    if (r.number) d.numbers.add(r.number);
    if (!NOT_STARTED.has(r.positionText)) {
      if (!d.races.has(r.raceId)) {
        d.races.add(r.raceId);
        d.starts++;
      }
      c.races.add(r.raceId);
    }
    if (r.position === 1) { d.wins++; c.wins++; }
    if (r.position !== null && r.position <= 3) { d.podiums++; c.podiums++; }
    if (r.fastestLapRank === 1) { d.fl++; c.fl++; }
  }
  for (const [, p] of poleByRace) {
    get(dAgg, p.driverId).poles++;
    get(cAgg, p.constructorId).poles++;
  }

  const driverTitles = new Map<string, number>();
  const teamDriverTitles = new Map<string, number>();
  const completeYears = new Set(champs.filter((s) => s.championDriverId).map((s) => s.year));
  for (const s of finalStandings) {
    if (!completeYears.has(s.year)) continue;
    driverTitles.set(s.driverId, (driverTitles.get(s.driverId) ?? 0) + 1);
    const team = s.constructorIds.at(-1);
    if (team) teamDriverTitles.set(team, (teamDriverTitles.get(team) ?? 0) + 1);
  }
  const teamTitles = new Map<string, number>();
  for (const s of champs) if (s.championConstructorId) teamTitles.set(s.championConstructorId, (teamTitles.get(s.championConstructorId) ?? 0) + 1);

  const activeDrivers = new Set(results.filter((r) => r.raceId.startsWith(`${latestYear}-`)).map((r) => r.driverId));
  const activeTeams = new Set(results.filter((r) => r.raceId.startsWith(`${latestYear}-`)).map((r) => r.constructorId));

  const drivers = await prisma.driver.findMany({ select: { id: true } });
  for (const { id } of drivers) {
    const a = dAgg.get(id) ?? blank();
    const years = [...a.years].sort((x, y) => x - y);
    await prisma.driver.update({
      where: { id },
      data: {
        starts: a.starts, wins: a.wins, poles: a.poles, podiums: a.podiums, fastestLaps: a.fl,
        points: Math.round(a.points * 100) / 100,
        titles: driverTitles.get(id) ?? 0,
        firstYear: years[0] ?? null,
        lastYear: years.at(-1) ?? null,
        numbers: [...a.numbers].sort((x, y) => Number(x) - Number(y)),
      },
    });
  }

  const lineage = await prisma.constructorLineage.findMany();
  const hasSuccessor = new Set(lineage.map((l) => l.predecessorId));
  const teams = await prisma.team.findMany({ select: { id: true } });
  for (const { id } of teams) {
    const a = cAgg.get(id) ?? blank();
    const years = [...a.years].sort((x, y) => x - y);
    await prisma.team.update({
      where: { id },
      data: {
        entries: a.races.size, wins: a.wins, poles: a.poles, podiums: a.podiums,
        points: Math.round(a.points * 100) / 100,
        driverTitles: teamDriverTitles.get(id) ?? 0,
        constructorTitles: teamTitles.get(id) ?? 0,
        firstYear: years[0] ?? null,
        lastYear: years.at(-1) ?? null,
        status: activeTeams.has(id) ? "ACTIVE" : hasSuccessor.has(id) ? "BECAME_ANOTHER_TEAM" : "DEFUNCT",
      },
    });
  }

  // Circuits
  const races = await prisma.race.findMany({ select: { circuitId: true, year: true } });
  const cStats = new Map<string, { first: number; last: number; n: number }>();
  for (const r of races) {
    const s = cStats.get(r.circuitId);
    if (!s) cStats.set(r.circuitId, { first: r.year, last: r.year, n: 1 });
    else { s.first = Math.min(s.first, r.year); s.last = Math.max(s.last, r.year); s.n++; }
  }
  const lapRecords = await prisma.$queryRaw<{ circuitId: string; best: string; driver: string; year: number }[]>`
    SELECT DISTINCT ON (ra."circuitId") ra."circuitId", r."fastestLapTime" AS best, d."fullName" AS driver, ra.year
    FROM "Result" r JOIN "Race" ra ON ra.id = r."raceId" JOIN "Driver" d ON d.id = r."driverId"
    WHERE r."fastestLapTime" ~ '^[0-9]+:[0-9]+(\\.[0-9]+)?$' AND r."isSprint" = false
    ORDER BY ra."circuitId",
      (split_part(r."fastestLapTime", ':', 1)::numeric * 60 + split_part(r."fastestLapTime", ':', 2)::numeric) ASC`;
  const lr = new Map(lapRecords.map((l) => [l.circuitId, `${l.best} — ${l.driver} (${l.year})`]));
  for (const [id, s] of cStats) {
    await prisma.circuit.update({
      where: { id },
      data: { firstYear: s.first, lastYear: s.last, raceCount: s.n, isActive: s.last >= latestYear, lapRecord: lr.get(id) ?? null },
    });
  }
  console.log(`  stats recomputed (latest season ${latestYear}; active drivers ${activeDrivers.size})`);
}
