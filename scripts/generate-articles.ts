/**
 * Generate long-form articles for seasons, teams, drivers and circuits.
 *
 *   npm run ai:articles                    # template articles for everything missing;
 *                                          # AI articles for major entities if ANTHROPIC_API_KEY is set
 *   npm run ai:articles -- --type=DRIVER --limit=20 --force
 *   npm run ai:articles -- --ai=all        # AI for every entity (costly: ~1,200 calls)
 *   npm run ai:articles -- --ai=none       # template only
 *
 * Human-edited articles (editedBy not "ai"/"template") are never overwritten.
 */
import "./lib/env";
import { PrismaClient, type EntityType } from "@prisma/client";
import { generateAiArticle, generateTemplateArticle, saveArticle } from "../src/lib/articles";
import { aiEnabled } from "../src/lib/ai/claude";

const prisma = new PrismaClient();
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? "true"]; }));

interface Job { type: EntityType; id: string; major: boolean }

async function jobs(): Promise<Job[]> {
  const [seasons, teams, drivers, circuits] = await Promise.all([
    prisma.season.findMany({ select: { year: true } }),
    prisma.team.findMany({ select: { id: true, entries: true, wins: true, status: true, whyDisappeared: true } }),
    prisma.driver.findMany({ select: { id: true, wins: true, titles: true, starts: true }, where: { starts: { gt: 0 } } }),
    prisma.circuit.findMany({ select: { id: true, raceCount: true }, where: { raceCount: { gt: 0 } } }),
  ]);
  return [
    ...seasons.map((s) => ({ type: "SEASON" as const, id: String(s.year), major: true })),
    ...teams.filter((t) => t.entries > 0).map((t) => ({ type: "TEAM" as const, id: t.id, major: t.entries >= 30 || t.wins > 0 || Boolean(t.whyDisappeared) })),
    ...drivers.map((d) => ({ type: "DRIVER" as const, id: d.id, major: d.wins > 0 || d.titles > 0 || d.starts >= 60 })),
    ...circuits.map((c) => ({ type: "CIRCUIT" as const, id: c.id, major: c.raceCount >= 5 })),
  ];
}

async function main() {
  const aiMode = !aiEnabled() ? "none" : (args.ai ?? "major");
  const force = args.force === "true";
  const concurrency = Number(args.concurrency ?? 4);
  let list = await jobs();
  if (args.type) list = list.filter((j) => j.type === args.type.toUpperCase());

  const existing = new Map(
    (await prisma.article.findMany({ select: { entityType: true, entityId: true, editedBy: true, aiGenerated: true } })).map((a) => [`${a.entityType}:${a.entityId}`, a]),
  );
  const todo = list.filter((j) => {
    const a = existing.get(`${j.type}:${j.id}`);
    if (!a) return true;
    if (a.editedBy !== "ai" && a.editedBy !== "template") return false; // human edit wins
    const wantAi = aiMode === "all" || (aiMode === "major" && j.major);
    return force || (wantAi && !a.aiGenerated);
  });
  const limited = todo.slice(0, Number(args.limit ?? Infinity));
  console.log(`Articles: ${limited.length} to write (AI mode: ${aiMode})`);

  let done = 0, failed = 0;
  const queue = [...limited];
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      for (let j = queue.shift(); j; j = queue.shift()) {
        const useAi = aiMode === "all" || (aiMode === "major" && j.major);
        try {
          const article = useAi ? await generateAiArticle(prisma, j.type, j.id) : await generateTemplateArticle(prisma, j.type, j.id);
          if (article?.body) await saveArticle(prisma, j.type, j.id, article);
          done++;
          if (done % 50 === 0 || useAi) console.log(`  ${done}/${limited.length} ${j.type} ${j.id}${useAi ? " (AI)" : ""}`);
        } catch (e) {
          failed++;
          console.warn(`  ! ${j.type} ${j.id}: ${(e as Error).message}`);
          if (useAi) {
            const fallback = await generateTemplateArticle(prisma, j.type, j.id);
            if (fallback?.body && !existing.has(`${j.type}:${j.id}`)) await saveArticle(prisma, j.type, j.id, fallback);
          }
        }
      }
    }),
  );
  console.log(`Articles done: ${done} written, ${failed} failed.`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
