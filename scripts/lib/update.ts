/**
 * Shared by the CLI update script and the /api/cron/update route.
 * The chat assistant builds fact sheets live from the database for entities it
 * links, so fresh results are answerable immediately; run `npm run ai:embed`
 * afterwards to refresh the vector index for changed chunks.
 */
import type { PrismaClient } from "@prisma/client";
import { ingestSeason, recomputeStats } from "./ingest";
import { buildSeasonHeadlines, ingestCurated } from "./curated";
import { generateAiArticle, generateTemplateArticle, saveArticle } from "../../src/lib/articles";
import { aiEnabled } from "../../src/lib/ai/claude";

export async function updateCurrentSeason(prisma: PrismaClient, opts: { year?: number } = {}) {
  const year = opts.year ?? new Date().getUTCFullYear();
  const run = await prisma.ingestRun.create({ data: { job: `update-${year}` } });
  try {
    const { races, results } = await ingestSeason(prisma, year, true);
    await ingestCurated(prisma);
    await recomputeStats(prisma);
    await buildSeasonHeadlines(prisma);

    // Refresh the season article unless a human has edited it.
    const art = await prisma.article.findUnique({ where: { entityType_entityId: { entityType: "SEASON", entityId: String(year) } } });
    if (!art || art.editedBy === "ai" || art.editedBy === "template") {
      const a = aiEnabled() ? await generateAiArticle(prisma, "SEASON", String(year)) : await generateTemplateArticle(prisma, "SEASON", String(year));
      if (a) await saveArticle(prisma, "SEASON", String(year), a);
    }
    const message = `${year}: ${races} races, ${results} results`;
    await prisma.ingestRun.update({ where: { id: run.id }, data: { ok: true, finishedAt: new Date(), message } });
    return { ok: true, message };
  } catch (e) {
    await prisma.ingestRun.update({ where: { id: run.id }, data: { ok: false, finishedAt: new Date(), message: (e as Error).message } });
    throw e;
  }
}
