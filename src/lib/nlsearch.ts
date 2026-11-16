/**
 * Natural-language search: "Ferrari wins in the rain in the 90s".
 * The query is turned into structured filters (Claude structured output when
 * available, a heuristic parser otherwise), run as SQL over races, and paired
 * with full-text passages for criteria the structured data doesn't hold (e.g. weather).
 */
import { prisma } from "./db";
import { aiEnabled, completeJson } from "./ai/claude";
import { linkEntities } from "./ai/retrieval";
import { searchKey } from "./text";

export interface NlFilters {
  outcome: "win" | "pole" | "podium" | "any";
  driverId: string | null;
  teamId: string | null;
  circuitId: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  keywords: string[];
  unsupported: string[];
  explanation: string;
}

/** "90s" → 1990–1999, "1970s" → 1970–1979, "2000s" → 2000–2009, "10s" → 2010–2019. */
export function decadeRange(q: string): [number, number] | null {
  const m = q.match(/\b(19|20)?(\d)0'?s\b/i);
  if (!m) return null;
  const d = Number(m[2]);
  const century = m[1] ? Number(m[1]) * 100 : d >= 5 ? 1900 : 2000;
  const start = century + d * 10;
  return [start, start + 9];
}

export async function heuristicFilters(q: string): Promise<NlFilters> {
  const key = searchKey(q);
  const ents = await linkEntities(q);
  const years = [...q.matchAll(/\b(19[5-9]\d|20[0-4]\d)\b/g)].map((m) => Number(m[1]));
  const dec = decadeRange(key);
  const unsupported: string[] = [];
  const keywords: string[] = [];
  if (/\b(rain|wet|weather|snow)\b/.test(key)) {
    unsupported.push("weather");
    keywords.push("rain", "wet");
  }
  return {
    outcome: /\bpoles?\b/.test(key) ? "pole" : /\bpodiums?\b/.test(key) ? "podium" : /\b(win|wins|won|victor)/.test(key) ? "win" : "any",
    driverId: ents.find((e) => e.type === "DRIVER")?.id ?? null,
    teamId: ents.find((e) => e.type === "TEAM")?.id ?? null,
    circuitId: ents.find((e) => e.type === "CIRCUIT")?.id ?? null,
    yearFrom: years.length ? Math.min(...years) : dec?.[0] ?? null,
    yearTo: years.length ? Math.max(...years) : dec?.[1] ?? null,
    keywords,
    unsupported,
    explanation: "",
  };
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    outcome: { type: "string", enum: ["win", "pole", "podium", "any"] },
    driverName: { type: ["string", "null"] },
    teamName: { type: ["string", "null"] },
    circuitName: { type: ["string", "null"] },
    yearFrom: { type: ["integer", "null"] },
    yearTo: { type: ["integer", "null"] },
    keywords: { type: "array", items: { type: "string" } },
    unsupported: { type: "array", items: { type: "string" } },
    explanation: { type: "string" },
  },
  required: ["outcome", "driverName", "teamName", "circuitName", "yearFrom", "yearTo", "keywords", "unsupported", "explanation"],
};

export async function parseQuery(q: string): Promise<NlFilters> {
  const base = await heuristicFilters(q);
  if (!aiEnabled()) return base;
  try {
    const ai = await completeJson<{
      outcome: NlFilters["outcome"]; driverName: string | null; teamName: string | null; circuitName: string | null;
      yearFrom: number | null; yearTo: number | null; keywords: string[]; unsupported: string[]; explanation: string;
    }>({
      system:
        "Convert a Formula 1 archive search query into filters. The structured database holds race results (winner, pole, podium), drivers, teams, circuits and years only — NOT weather, crashes, overtakes or tyres. Put criteria the database cannot filter into `unsupported` and add useful full-text `keywords` for them (e.g. 'rain','wet'). Decades like 'the 90s' mean 1990–1999. `explanation` is one short sentence describing what will be shown.",
      messages: [{ role: "user", content: q }],
      schema: SCHEMA,
      effort: "low",
      maxTokens: 800,
    });
    const find = async (name: string | null, type: "DRIVER" | "TEAM" | "CIRCUIT") => {
      if (!name) return null;
      const ents = await linkEntities(name);
      return ents.find((e) => e.type === type)?.id ?? null;
    };
    return {
      outcome: ai.outcome,
      driverId: (await find(ai.driverName, "DRIVER")) ?? base.driverId,
      teamId: (await find(ai.teamName, "TEAM")) ?? base.teamId,
      circuitId: (await find(ai.circuitName, "CIRCUIT")) ?? base.circuitId,
      yearFrom: ai.yearFrom ?? base.yearFrom,
      yearTo: ai.yearTo ?? base.yearTo,
      keywords: ai.keywords.length ? ai.keywords : base.keywords,
      unsupported: ai.unsupported,
      explanation: ai.explanation,
    };
  } catch (e) {
    console.warn("nl parse fallback:", (e as Error).message);
    return base;
  }
}

export async function runNlSearch(q: string) {
  const f = await parseQuery(q);
  const hasStructured = f.driverId || f.teamId || f.circuitId || f.yearFrom;
  let races: { id: string; year: number; name: string; slug: string; date: Date; driver: string; team: string; position: number | null; circuit: string }[] = [];
  if (hasStructured) {
    const posFilter = f.outcome === "win" ? { position: 1 } : f.outcome === "podium" ? { position: { lte: 3 } } : f.outcome === "pole" ? { grid: 1 } : {};
    const rows = await prisma.result.findMany({
      where: {
        isSprint: false,
        ...posFilter,
        ...(f.driverId ? { driverId: f.driverId } : {}),
        ...(f.teamId ? { constructorId: f.teamId } : {}),
        race: {
          ...(f.circuitId ? { circuitId: f.circuitId } : {}),
          ...(f.yearFrom ? { year: { gte: f.yearFrom, lte: f.yearTo ?? f.yearFrom } } : {}),
        },
        ...(f.outcome === "any" && !f.driverId && !f.teamId ? { position: 1 } : {}),
      },
      include: { race: { include: { circuit: true } }, driver: true, team: true },
      orderBy: { race: { date: "asc" } },
      take: 200,
    });
    races = rows.map((r) => ({
      id: r.raceId, year: r.race.year, name: r.race.name, slug: r.race.slug, date: r.race.date,
      driver: r.driver.fullName, team: r.team.name, position: r.position, circuit: r.race.circuit.name,
    }));
  }
  // Full-text passages for unsupported criteria (e.g. "rain"), restricted to matching entities when possible.
  let passages: { title: string; url: string; content: string }[] = [];
  const terms = [...f.keywords, ...(hasStructured ? [] : [q])].join(" ");
  if (terms.trim()) {
    passages = await prisma.$queryRawUnsafe<{ title: string; url: string; content: string }[]>(
      `SELECT title, url, content FROM "Embedding"
       WHERE to_tsvector('english', title || ' ' || content) @@ to_tsquery('english', replace(plainto_tsquery('english', $1)::text, '&', '|'))
       ${f.yearFrom ? `AND (content ~ $2)` : ""}
       ORDER BY ts_rank_cd(to_tsvector('english', title || ' ' || content), to_tsquery('english', replace(plainto_tsquery('english', $1)::text, '&', '|'))) DESC
       LIMIT 12`,
      terms,
      ...(f.yearFrom ? [`\\m(${Array.from({ length: (f.yearTo ?? f.yearFrom) - f.yearFrom + 1 }, (_, i) => f.yearFrom! + i).join("|")})\\M`] : []),
    );
  }
  return { filters: f, races, passages };
}
