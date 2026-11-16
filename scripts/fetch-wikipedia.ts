/** Refresh Wikipedia extracts + Wikidata ids only. Usage: npm run data:wiki */
import "./lib/env";
import { PrismaClient } from "@prisma/client";
import { syncWikipedia } from "./lib/wikisync";

const prisma = new PrismaClient();
syncWikipedia(prisma)
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
