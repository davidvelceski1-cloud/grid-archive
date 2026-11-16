/**
 * RAG index builder: chunk every archive page (fact sheets, articles, Wikipedia
 * extracts, race results, eras, glossary) into the Embedding table, then, if
 * VOYAGE_API_KEY is set, embed chunks that have no vector yet.
 *
 *   npm run ai:embed                 # rebuild chunks + embed missing
 *   npm run ai:embed -- --skip-chunks
 */
import "./lib/env";
import { PrismaClient, type EntityType } from "@prisma/client";
import { circuitFacts, driverFacts, seasonFacts, teamFacts, type FactSheet } from "../src/lib/facts";
import { embed, embeddingsEnabled, toVectorLiteral } from "../src/lib/ai/embeddings";
import { chunkFacts, chunkMarkdown } from "../src/lib/ai/chunk";
import { formatDate } from "../src/lib/text";

const prisma = new PrismaClient();
const args = new Set(process.argv.slice(2));

type Row = { entityType: EntityType; entityId: string; url: string; title: string; content: string };

async function rowsForSheet(sheet: FactSheet | null): Promise<Row[]> {
  if (!sheet) return [];
  const rows: Row[] = chunkFacts(sheet.facts).map((content) => ({ entityType: sheet.type as EntityType, entityId: sheet.id, url: sheet.url, title: sheet.title, content }));
  const article = await prisma.article.findUnique({ where: { entityType_entityId: { entityType: sheet.type as EntityType, entityId: sheet.id } } });
  if (article) for (const content of chunkMarkdown(article.body)) rows.push({ entityType: sheet.type as EntityType, entityId: sheet.id, url: sheet.url, title: `${sheet.title} — article`, content });
  return rows;
}

async function buildChunks() {
  const rows: Row[] = [];
  for (const s of await prisma.season.findMany({ select: { year: true } })) rows.push(...(await rowsForSheet(await seasonFacts(prisma, s.year))));
  for (const t of await prisma.team.findMany({ where: { entries: { gt: 0 } }, select: { id: true } })) rows.push(...(await rowsForSheet(await teamFacts(prisma, t.id))));
  for (const c of await prisma.circuit.findMany({ where: { raceCount: { gt: 0 } }, select: { id: true } })) rows.push(...(await rowsForSheet(await circuitFacts(prisma, c.id))));
  const drivers = await prisma.driver.findMany({ where: { starts: { gt: 0 } }, select: { id: true } });
  for (const [i, d] of drivers.entries()) {
    rows.push(...(await rowsForSheet(await driverFacts(prisma, d.id))));
    if (i % 200 === 0) console.log(`  drivers ${i}/${drivers.length}`);
  }

  // Race result chunks: top-10 classification for every Grand Prix.
  const races = await prisma.race.findMany({
    where: { winnerDriverId: { not: null } },
    include: {
      circuit: true,
      results: { where: { isSprint: false }, orderBy: { positionOrder: "asc" }, take: 10, include: { driver: true, team: true } },
    },
  });
  for (const r of races) {
    const lines = r.results.map((x) => `${x.positionText}. ${x.driver.fullName} (${x.team.name})${x.status && !/^\+|Finished/.test(x.status) ? ` — ${x.status}` : ""}`);
    rows.push({
      entityType: "RACE",
      entityId: r.id,
      url: `/seasons/${r.year}/${r.slug}`,
      title: `${r.year} ${r.name}`,
      content: `${r.year} ${r.name}, round ${r.round}, ${r.circuit.name} (${r.circuit.country}), ${formatDate(r.date)}. Classification: ${lines.join("; ")}.`,
    });
  }

  for (const e of await prisma.era.findMany()) {
    const url = `/eras/${e.slug}`;
    rows.push({ entityType: "ERA", entityId: e.slug, url, title: `${e.name} era`, content: `${e.name} (${e.startYear}–${e.endYear ?? "present"}): ${e.summary}` });
    for (const content of chunkMarkdown(e.body)) rows.push({ entityType: "ERA", entityId: e.slug, url, title: `${e.name} era`, content });
  }
  for (const g of await prisma.glossaryTerm.findMany()) {
    rows.push({ entityType: "GLOSSARY", entityId: g.slug, url: `/glossary#${g.slug}`, title: g.term, content: `${g.term}: ${g.short} ${g.long}` });
  }
  for (const w of await prisma.wikiExtract.findMany()) {
    const base = w.entityType === "SEASON" ? `/seasons/${w.entityId}` : null;
    let url = base;
    if (!url) {
      const slug =
        w.entityType === "DRIVER" ? (await prisma.driver.findUnique({ where: { id: w.entityId }, select: { slug: true } }))?.slug :
        w.entityType === "TEAM" ? (await prisma.team.findUnique({ where: { id: w.entityId }, select: { slug: true } }))?.slug :
        (await prisma.circuit.findUnique({ where: { id: w.entityId }, select: { slug: true } }))?.slug;
      if (!slug) continue;
      url = `/${w.entityType === "DRIVER" ? "drivers" : w.entityType === "TEAM" ? "teams" : "circuits"}/${slug}`;
    }
    for (const content of chunkMarkdown(w.extract).slice(0, 3)) {
      rows.push({ entityType: w.entityType, entityId: w.entityId, url, title: `${w.title} (Wikipedia, CC BY-SA)`, content });
    }
  }

  // Number chunks per entity, replace the table.
  const counters = new Map<string, number>();
  const data = rows.map((r) => {
    const key = `${r.entityType}:${r.entityId}`;
    const chunkIndex = counters.get(key) ?? 0;
    counters.set(key, chunkIndex + 1);
    return { ...r, chunkIndex };
  });
  // Diff against the existing index so unchanged chunks keep their (paid-for) vectors.
  const existing = await prisma.embedding.findMany({ select: { id: true, entityType: true, entityId: true, chunkIndex: true, content: true, title: true, url: true } });
  const key = (r: { entityType: string; entityId: string; chunkIndex: number }) => `${r.entityType}:${r.entityId}:${r.chunkIndex}`;
  const old = new Map(existing.map((r) => [key(r), r]));
  const fresh = [];
  let changed = 0;
  for (const r of data) {
    const prev = old.get(key(r));
    old.delete(key(r));
    if (!prev) fresh.push(r);
    else if (prev.content !== r.content || prev.title !== r.title || prev.url !== r.url) {
      await prisma.$executeRaw`UPDATE "Embedding" SET content = ${r.content}, title = ${r.title}, url = ${r.url}, embedding = NULL WHERE id = ${prev.id}`;
      changed++;
    }
  }
  const stale = [...old.values()].map((r) => r.id);
  for (let i = 0; i < stale.length; i += 1000) await prisma.embedding.deleteMany({ where: { id: { in: stale.slice(i, i + 1000) } } });
  for (let i = 0; i < fresh.length; i += 1000) await prisma.embedding.createMany({ data: fresh.slice(i, i + 1000) });
  console.log(`  chunks: ${data.length} total — ${fresh.length} new, ${changed} changed, ${stale.length} removed`);
}

async function embedMissing() {
  if (!embeddingsEnabled()) {
    console.log("  VOYAGE_API_KEY not set — skipping vectors (full-text retrieval still works).");
    return;
  }
  for (;;) {
    const batch = await prisma.$queryRaw<{ id: number; title: string; content: string }[]>`
      SELECT id, title, content FROM "Embedding" WHERE embedding IS NULL ORDER BY id LIMIT 96`;
    if (!batch.length) break;
    const vectors = await embed(batch.map((b) => `${b.title}\n${b.content}`), "document");
    for (const [i, b] of batch.entries()) {
      await prisma.$executeRawUnsafe(`UPDATE "Embedding" SET embedding = $1::vector WHERE id = $2`, toVectorLiteral(vectors[i]), b.id);
    }
    console.log(`  embedded ${batch.length} (last id ${batch.at(-1)!.id})`);
  }
}

async function main() {
  if (!args.has("--skip-chunks")) await buildChunks();
  await embedMissing();
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
