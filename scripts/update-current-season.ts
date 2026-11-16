/**
 * Post-race-weekend update job. Re-downloads the current season from Jolpica
 * (bypassing the cache), recomputes stats, refreshes template articles for the
 * season and re-indexes changed chunks.
 *
 * Runs:  npm run update:current
 * Schedule: Vercel Cron hits /api/cron/update (see vercel.json) every Monday
 * 06:00 UTC, or run this script from any scheduler (GitHub Actions, cron).
 */
import "./lib/env";
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { updateCurrentSeason } from "./lib/update";

const prisma = new PrismaClient();

updateCurrentSeason(prisma)
  .then((r) => {
    console.log(r);
    execSync("npx tsx scripts/build-embeddings.ts", { stdio: "inherit" });
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
