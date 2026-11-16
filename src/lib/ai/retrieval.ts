/**
 * Hybrid retrieval over the Embedding table:
 *   1. Entity linking: names and years mentioned in the question pull in that
 *      entity's chunks directly (most reliable signal for an F1 archive).
 *   2. Postgres full-text search (OR-ed terms, ranked).
 *   3. pgvector cosine similarity when VOYAGE_API_KEY is configured.
 * Results are merged with reciprocal-rank fusion.
 */
import type { EntityType } from "@prisma/client";
import { prisma } from "../db";
import { searchKey } from "../text";
import { embed, embeddingsEnabled, toVectorLiteral } from "./embeddings";

export interface Chunk {
  id: number;
  entityType: EntityType;
  entityId: string;
  url: string;
  title: string;
  chunkIndex: number;
  content: string;
}

export interface PageContext {
  type: EntityType;
  id: string;
  title?: string;
}

const COLS = `id, "entityType", "entityId", url, title, "chunkIndex", content`;

async function ftsSearch(q: string, limit: number): Promise<Chunk[]> {
  return prisma.$queryRawUnsafe<Chunk[]>(
    `WITH q AS (
       SELECT CASE WHEN plainto_tsquery('english', $1)::text = '' THEN NULL
              ELSE to_tsquery('english', replace(plainto_tsquery('english', $1)::text, '&', '|')) END AS tsq)
     SELECT ${COLS} FROM "Embedding", q
     WHERE q.tsq IS NOT NULL AND to_tsvector('english', title || ' ' || content) @@ q.tsq
     ORDER BY ts_rank_cd(to_tsvector('english', title || ' ' || content), q.tsq) DESC
     LIMIT $2`,
    q,
    limit,
  );
}

async function vectorSearch(q: string, limit: number): Promise<Chunk[]> {
  if (!embeddingsEnabled()) return [];
  try {
    const [v] = await embed([q], "query");
    return await prisma.$queryRawUnsafe<Chunk[]>(
      `SELECT ${COLS} FROM "Embedding" WHERE embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector LIMIT $2`,
      toVectorLiteral(v),
      limit,
    );
  } catch (e) {
    console.warn("vector search unavailable:", (e as Error).message);
    return [];
  }
}

const STOP = new Set(
  "about after against also been before being between both came championship championships compare could did does driver drivers during each ever every fastest first from grand have here into last like many more most much other over pole prix race races racing season seasons since some than that their them then there these they this those team teams time title titles under very were what when where which while who whom whose will with won wins would year years".split(" "),
);

/** Edit distance with an early exit once it exceeds `max`. */
export function levenshtein(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

let vocab: { words: Map<string, number>; at: number } | null = null;

/** Name tokens from drivers, teams and circuits, weighted by how prominent they are. */
async function nameVocabulary() {
  if (vocab && Date.now() - vocab.at < 3_600_000) return vocab.words;
  const [d, t, c] = await Promise.all([
    prisma.driver.findMany({ select: { familyName: true, starts: true } }),
    prisma.team.findMany({ select: { searchName: true, entries: true } }),
    prisma.circuit.findMany({ select: { searchName: true, raceCount: true } }),
  ]);
  const words = new Map<string, number>();
  const add = (s: string, w: number) => {
    for (const tok of searchKey(s).split(/[^a-z0-9]+/)) if (tok.length >= 4) words.set(tok, Math.max(words.get(tok) ?? 0, w));
  };
  d.forEach((x) => add(x.familyName, x.starts));
  t.forEach((x) => add(x.searchName, x.entries));
  c.forEach((x) => add(x.searchName, x.raceCount * 10));
  vocab = { words, at: Date.now() };
  return words;
}

/**
 * Fix misspelt names ("tyrell" → "tyrrell", "verstapen" → "verstappen") by matching
 * unknown words against real driver/team/circuit name tokens (edit distance 1, or 2
 * for long words). Ordinary English words are left alone.
 */
export async function correctSpelling(q: string): Promise<string> {
  const words = await nameVocabulary();
  return q.replace(/[\p{L}]{5,}/gu, (raw) => {
    const w = searchKey(raw);
    if (words.has(w) || STOP.has(w)) return raw;
    const max = w.length >= 8 ? 2 : 1;
    let best: { tok: string; d: number; weight: number } | null = null;
    for (const [tok, weight] of words) {
      if (tok[0] !== w[0]) continue;
      const d = levenshtein(w, tok, max);
      if (d <= max && (!best || d < best.d || (d === best.d && weight > best.weight))) best = { tok, d, weight };
    }
    return best ? best.tok : raw;
  });
}

/** Find archive entities named in the question. */
export async function linkEntities(q: string): Promise<{ type: EntityType; id: string }[]> {
  const key = searchKey(await correctSpelling(q));
  const out: { type: EntityType; id: string }[] = [];
  for (const m of q.matchAll(/\b(19[5-9]\d|20[0-4]\d)\b/g)) out.push({ type: "SEASON", id: m[1] });

  const words = key.split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !STOP.has(w));
  if (!words.length) return out;
  const like = words.map((w) => `%${w}%`);
  const [drivers, teams, circuits] = await Promise.all([
    prisma.driver.findMany({
      where: { OR: like.map((l) => ({ familyName: { contains: l.slice(1, -1), mode: "insensitive" as const } })) },
      select: { id: true, familyName: true, fullName: true, starts: true },
      orderBy: { starts: "desc" },
      take: 30,
    }),
    prisma.team.findMany({
      where: { OR: like.map((l) => ({ searchName: { contains: l.slice(1, -1) } })) },
      select: { id: true, searchName: true, entries: true },
      orderBy: { entries: "desc" },
      take: 10,
    }),
    prisma.circuit.findMany({
      where: { OR: like.map((l) => ({ searchName: { contains: l.slice(1, -1) } })) },
      select: { id: true, searchName: true, raceCount: true },
      orderBy: { raceCount: "desc" },
      take: 5,
    }),
  ]);
  // Prefer full-name matches; otherwise keep the most prolific driver per surname.
  const bySurname = new Map<string, (typeof drivers)[number]>();
  for (const d of drivers) {
    const surname = searchKey(d.familyName);
    if (!words.some((w) => surname.split(" ").includes(w))) continue;
    const full = key.includes(searchKey(d.fullName));
    const prev = bySurname.get(surname);
    if (!prev || full) bySurname.set(surname, d);
  }
  for (const d of bySurname.values()) out.push({ type: "DRIVER", id: d.id });
  const used = new Set<string>();
  for (const d of bySurname.values()) searchKey(d.familyName).split(" ").forEach((w) => used.add(w));
  for (const t of teams) {
    const hit = words.filter((w) => t.searchName.split(/\s+/).includes(w));
    if (hit.length) {
      out.push({ type: "TEAM", id: t.id });
      hit.forEach((w) => used.add(w));
    }
  }
  // A circuit only counts when matched by a word not already explained by a team or driver
  // ("Ferrari" must not select the Autodromo Enzo e Dino Ferrari).
  for (const c of circuits) {
    if (out.filter((e) => e.type === "CIRCUIT").length >= 2) break;
    const circuitWords = c.searchName.split(/[^a-z0-9]+/);
    if (words.some((w) => !used.has(w) && circuitWords.includes(w))) out.push({ type: "CIRCUIT", id: c.id });
  }
  return out.slice(0, 8);
}

async function entityChunks(ents: { type: EntityType; id: string }[], perEntity: number): Promise<Chunk[]> {
  if (!ents.length) return [];
  const rows = await prisma.embedding.findMany({
    where: { OR: ents.map((e) => ({ entityType: e.type, entityId: e.id, chunkIndex: { lt: perEntity } })) },
    select: { id: true, entityType: true, entityId: true, url: true, title: true, chunkIndex: true, content: true },
    orderBy: [{ chunkIndex: "asc" }],
  });
  return rows;
}

export async function retrieve(question: string, opts: { k?: number; context?: PageContext | null } = {}): Promise<Chunk[]> {
  const k = opts.k ?? 10;
  question = await correctSpelling(question);
  const ents = await linkEntities(question);
  if (opts.context) ents.unshift({ type: opts.context.type, id: opts.context.id });

  const [linked, fts, vec] = await Promise.all([entityChunks(ents, 4), ftsSearch(question, 24), vectorSearch(question, 24)]);

  const scores = new Map<number, { chunk: Chunk; score: number }>();
  const add = (list: Chunk[], weight: number) =>
    list.forEach((c, rank) => {
      const s = scores.get(c.id) ?? { chunk: c, score: 0 };
      s.score += weight / (60 + rank);
      scores.set(c.id, s);
    });
  add(linked, 1.6);
  add(fts, 1.0);
  add(vec, 1.2);

  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((s) => s.chunk);
}
