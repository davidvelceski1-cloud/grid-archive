/**
 * Jolpica-F1 (Ergast-compatible) client. https://api.jolpi.ca/ergast/f1/
 * Responses are cached on disk under data/cache/jolpica, so re-running the seed
 * never re-downloads history. Jolpica's public limit is ~4 req/s burst and
 * 500 req/hour sustained; the default interval keeps us under that.
 */
import { fetchJson, setThrottle } from "./http";

const BASE = process.env.JOLPICA_BASE_URL ?? "https://api.jolpi.ca/ergast/f1";
const INTERVAL = Number(process.env.JOLPICA_INTERVAL_MS ?? 7_500);
setThrottle(new URL(BASE).host, INTERVAL);

export interface JDriver {
  driverId: string;
  permanentNumber?: string;
  code?: string;
  url?: string;
  givenName: string;
  familyName: string;
  dateOfBirth?: string;
  nationality?: string;
}
export interface JConstructor {
  constructorId: string;
  url?: string;
  name: string;
  nationality?: string;
}
export interface JCircuit {
  circuitId: string;
  url?: string;
  circuitName: string;
  Location?: { lat?: string; long?: string; locality?: string; country?: string };
}
export interface JResult {
  number?: string;
  position?: string;
  positionText: string;
  points: string;
  Driver: JDriver;
  Constructor: JConstructor;
  grid?: string;
  laps?: string;
  status?: string;
  Time?: { millis?: string; time?: string };
  FastestLap?: { rank?: string; lap?: string; Time?: { time?: string } };
}
export interface JQualifying {
  number?: string;
  position: string;
  Driver: JDriver;
  Constructor: JConstructor;
  Q1?: string;
  Q2?: string;
  Q3?: string;
}
export interface JRace {
  season: string;
  round: string;
  url?: string;
  raceName: string;
  Circuit: JCircuit;
  date: string;
  time?: string;
  Results?: JResult[];
  SprintResults?: JResult[];
  QualifyingResults?: JQualifying[];
  Sprint?: { date: string };
}
export interface JDriverStanding {
  position?: string;
  positionText: string;
  points: string;
  wins: string;
  Driver: JDriver;
  Constructors: JConstructor[];
}
export interface JConstructorStanding {
  position?: string;
  positionText: string;
  points: string;
  wins: string;
  Constructor: JConstructor;
}

interface MRData {
  MRData: {
    total: string;
    limit: string;
    offset: string;
    [k: string]: unknown;
  };
}

const PAGE = 100;

async function paged<T>(
  path: string,
  pick: (mr: MRData["MRData"]) => T[],
  fresh = false,
): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const url = `${BASE}/${path}/?format=json&limit=${PAGE}&offset=${offset}`;
    const data = await fetchJson<MRData>(url, { namespace: "jolpica", fresh });
    out.push(...pick(data.MRData));
    if (offset + PAGE >= Number(data.MRData.total)) break;
  }
  return out;
}

/** Race pages can split one race's results across two pages: merge by round. */
function mergeRaces(pages: JRace[], key: "Results" | "SprintResults" | "QualifyingResults"): JRace[] {
  const byRound = new Map<string, JRace>();
  for (const r of pages) {
    const existing = byRound.get(r.round);
    if (!existing) byRound.set(r.round, { ...r, [key]: [...((r[key] as unknown[]) ?? [])] });
    else (existing[key] as unknown[]).push(...((r[key] as unknown[]) ?? []));
  }
  return [...byRound.values()].sort((a, b) => Number(a.round) - Number(b.round));
}

const races = (mr: MRData["MRData"]) => ((mr.RaceTable as { Races: JRace[] }).Races ?? []) as JRace[];

export const jolpica = {
  seasons: () =>
    paged<{ season: string; url?: string }>("seasons", (mr) => (mr.SeasonTable as { Seasons: { season: string; url?: string }[] }).Seasons),
  drivers: () => paged<JDriver>("drivers", (mr) => (mr.DriverTable as { Drivers: JDriver[] }).Drivers),
  constructors: () =>
    paged<JConstructor>("constructors", (mr) => (mr.ConstructorTable as { Constructors: JConstructor[] }).Constructors),
  circuits: () => paged<JCircuit>("circuits", (mr) => (mr.CircuitTable as { Circuits: JCircuit[] }).Circuits),
  schedule: (year: number, fresh = false) => paged<JRace>(`${year}/races`, races, fresh),
  results: async (year: number, fresh = false) => mergeRaces(await paged<JRace>(`${year}/results`, races, fresh), "Results"),
  sprints: async (year: number, fresh = false) =>
    year < 2021 ? [] : mergeRaces(await paged<JRace>(`${year}/sprint`, races, fresh), "SprintResults"),
  qualifying: async (year: number, fresh = false) =>
    mergeRaces(await paged<JRace>(`${year}/qualifying`, races, fresh), "QualifyingResults"),
  driverStandings: async (year: number, fresh = false) => {
    const lists = await paged<{ DriverStandings: JDriverStanding[] }>(
      `${year}/driverstandings`,
      (mr) => (mr.StandingsTable as { StandingsLists: { DriverStandings: JDriverStanding[] }[] }).StandingsLists,
      fresh,
    );
    return lists.flatMap((l) => l.DriverStandings);
  },
  constructorStandings: async (year: number, fresh = false) => {
    if (year < 1958) return [];
    const lists = await paged<{ ConstructorStandings: JConstructorStanding[] }>(
      `${year}/constructorstandings`,
      (mr) =>
        (mr.StandingsTable as { StandingsLists: { ConstructorStandings: JConstructorStanding[] }[] }).StandingsLists,
      fresh,
    );
    return lists.flatMap((l) => l.ConstructorStandings);
  },
};
