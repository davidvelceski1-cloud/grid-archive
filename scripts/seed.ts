/**
 * One-command population of GRID ARCHIVE:
 *
 *   npm run seed                 # everything
 *   npm run seed -- --no-images  # skip Wikimedia downloads
 *   npm run seed -- --from=2020  # only (re)load seasons from 2020
 *
 * Steps: Jolpica results → curated data → stats → Wikipedia extracts →
 * articles → images → RAG index. Each step is idempotent and cached, so an
 * interrupted seed can simply be re-run.
 */
import "./lib/env";
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { jolpica } from "./lib/jolpica";
import { ingestReference, ingestSeason, recomputeStats } from "./lib/ingest";
import { buildSeasonHeadlines, ingestCurated } from "./lib/curated";
import { syncWikipedia } from "./lib/wikisync";

const prisma = new PrismaClient();
const flags = new Set(process.argv.slice(2));
const fromArg = process.argv.find((a) => a.startsWith("--from="));

function step(name: string) {
  console.log(`\n▶ ${name}`);
}

async function main() {
  const run = await prisma.ingestRun.create({ data: { job: "seed" } });
  const t0 = Date.now();

  step("Reference data (drivers, constructors, circuits)");
  await ingestReference(prisma);

  step("Seasons, races, results, qualifying and standings");
  const years = (await jolpica.seasons()).map((s) => Number(s.season)).sort((a, b) => a - b);
  const from = fromArg ? Number(fromArg.split("=")[1]) : years[0];
  for (const y of years.filter((y) => y >= from)) {
    const { races, results } = await ingestSeason(prisma, y);
    console.log(`  ${y}: ${races} races, ${results} results`);
  }
  for (const s of await jolpica.seasons()) await prisma.season.updateMany({ where: { year: Number(s.season) }, data: { url: s.url ?? null } });

  step("Curated data (eras, lineage, cars, layouts, glossary, regulations)");
  await ingestCurated(prisma);

  step("Career statistics and champions");
  await recomputeStats(prisma);
  await buildSeasonHeadlines(prisma);

  if (!flags.has("--offline")) {
    step("Wikipedia extracts and Wikidata ids");
    await syncWikipedia(prisma);
  }

  await prisma.$disconnect();

  if (!flags.has("--offline")) {
    step("Chassis and engines for every team-season (Wikipedia entry lists)");
    execSync("npx tsx scripts/import-chassis.ts", { stdio: "inherit" });
  }

  step("Articles");
  execSync("npx tsx scripts/generate-articles.ts", { stdio: "inherit" });

  if (!flags.has("--no-images") && !flags.has("--offline")) {
    step("Images from Wikimedia Commons");
    execSync("npx tsx scripts/ingest-images.ts", { stdio: "inherit" });
  }

  step("RAG index (chunks + embeddings)");
  execSync("npx tsx scripts/build-embeddings.ts", { stdio: "inherit" });

  const db = new PrismaClient();
  await db.ingestRun.update({ where: { id: run.id }, data: { ok: true, finishedAt: new Date(), message: `seed finished in ${Math.round((Date.now() - t0) / 1000)}s` } });
  await db.$disconnect();
  console.log(`\n✔ GRID ARCHIVE seeded in ${Math.round((Date.now() - t0) / 60000)} min.`);
}

main().catch(async (e) => {
  console.error(e);
  process.exitCode = 1;
  await prisma.$disconnect();
});
