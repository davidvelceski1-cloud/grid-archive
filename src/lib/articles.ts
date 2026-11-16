/**
 * Long-form article generation.
 * - AI mode: Claude writes chapters grounded ONLY in the fact sheet + Wikipedia extract.
 * - Template mode (no API key, or minor entities): deterministic prose built from the facts.
 * Both are stored in Article; AI output is flagged `aiGenerated` and editable in /admin.
 */
import type { EntityType, PrismaClient } from "@prisma/client";
import { circuitFacts, driverFacts, factsToText, seasonFacts, teamFacts, type FactSheet } from "./facts";
import { completeText, CLAUDE_MODEL } from "./ai/claude";

export interface Source {
  title: string;
  url: string;
  license?: string;
}

const JOLPICA_SOURCE: Source = { title: "Jolpica-F1 results database", url: "https://api.jolpi.ca/ergast/f1/" };

export async function factSheetFor(db: PrismaClient, type: EntityType, id: string): Promise<FactSheet | null> {
  switch (type) {
    case "SEASON":
      return seasonFacts(db, Number(id));
    case "DRIVER":
      return driverFacts(db, id);
    case "TEAM":
      return teamFacts(db, id);
    case "CIRCUIT":
      return circuitFacts(db, id);
    default:
      return null;
  }
}

const CHAPTERS: Partial<Record<EntityType, string>> = {
  SEASON: "'The contenders', 'How the season unfolded' (key races and turning points), 'Technical and rule changes', 'Legacy'",
  DRIVER: "'Early life and junior career' (only if the Wikipedia extract covers it), 'Formula One career' (you may split this into chapters by team or period), 'After Formula One' (only if applicable), 'Legacy'",
  TEAM: "'Origins', one chapter per major era of the team's history, 'Lineage' (if it was renamed or sold), 'Why they disappeared' (defunct teams only), 'Legacy'",
  CIRCUIT: "'History', 'Layouts' (if layout changes are known), 'Famous moments', 'Masters of the track'",
};

export const ARTICLE_SYSTEM = `You are the senior archivist of GRID ARCHIVE, an unofficial encyclopedic archive of Formula 1 history.
Write in measured, authoritative museum-catalogue English (British spelling). Rules:
- Use ONLY the facts and the Wikipedia extract supplied. Never invent statistics, dates, quotes, results or anecdotes.
- If a chapter cannot be supported by the material, leave it out.
- Paraphrase rather than quote. Do not reproduce long passages from the extract.
- Output Markdown only: chapters start with "## " headings; no top-level title, no bullet-point fact dumps, no tables.
- 350–900 words depending on how much material there is.`;

export async function generateAiArticle(db: PrismaClient, type: EntityType, id: string) {
  const sheet = await factSheetFor(db, type, id);
  if (!sheet) return null;
  const wiki = await db.wikiExtract.findUnique({ where: { entityType_entityId: { entityType: type, entityId: id } } });
  const prompt = `Subject: ${sheet.title} (${type.toLowerCase()})
Suggested chapters: ${CHAPTERS[type] ?? "use sensible chapters"}

<archive_facts>
${factsToText(sheet)}
</archive_facts>

<wikipedia_extract source="${wiki?.url ?? "none"}">
${wiki?.extract ?? "(none available)"}
</wikipedia_extract>

Write the article now.`;
  const body = await completeText({ system: ARTICLE_SYSTEM, messages: [{ role: "user", content: prompt }], effort: "medium", maxTokens: 6000 });
  const sources: Source[] = [JOLPICA_SOURCE];
  if (wiki) sources.push({ title: `Wikipedia: ${wiki.title}`, url: wiki.url, license: "CC BY-SA 4.0" });
  return { title: sheet.title, body, sources, aiGenerated: true, model: CLAUDE_MODEL };
}

function bullets(lines: string[]) {
  return lines.map((l) => `- ${l}`).join("\n");
}

function para(...sentences: (string | false | null | undefined)[]) {
  return sentences.filter(Boolean).join(" ");
}

/** Deterministic, data-driven article used without an LLM key. */
export async function generateTemplateArticle(db: PrismaClient, type: EntityType, id: string) {
  const sheet = await factSheetFor(db, type, id);
  if (!sheet) return null;
  const wiki = await db.wikiExtract.findUnique({ where: { entityType_entityId: { entityType: type, entityId: id } } });
  const sources: Source[] = [JOLPICA_SOURCE];
  const parts: string[] = [];
  const intro = wiki?.extract?.split("\n").filter((p) => p.trim().length > 40).slice(0, 2).join("\n\n");
  if (intro) {
    parts.push(`## Overview\n\n${intro}\n\n*Adapted from the Wikipedia article “${wiki!.title}”, licensed CC BY-SA 4.0.*`);
    sources.push({ title: `Wikipedia: ${wiki!.title}`, url: wiki!.url, license: "CC BY-SA 4.0" });
  }
  const f = sheet.facts;
  if (type === "SEASON") {
    parts.push(`## The championship\n\n${para(f[0], f[1], f[2], f[3])}`);
    const results = f.filter((x) => /round \d+:/.test(x));
    if (results.length) parts.push(`## Race by race\n\n${bullets(results.map((x) => x.replace(/^\d{4} round (\d+): /, "Round $1: ")))}`);
    const rules = f.find((x) => x.startsWith("Rule changes"));
    if (rules) parts.push(`## Technical and rule changes\n\n${rules}`);
  } else if (type === "DRIVER") {
    parts.push(`## Formula One career\n\n${para(...f.slice(0, 4))}`);
    const rest = f.slice(4);
    if (rest.length) parts.push(`## Record\n\n${bullets(rest)}`);
  } else if (type === "TEAM") {
    parts.push(`## History\n\n${para(...f.filter((x) => !x.startsWith("Drivers who") && !x.includes("car:")).slice(0, 7))}`);
    const cars = f.filter((x) => x.includes(" car: "));
    if (cars.length) parts.push(`## Cars\n\n${bullets(cars)}`);
    const drivers = f.find((x) => x.startsWith("Drivers who"));
    if (drivers) parts.push(`## Drivers\n\n${drivers}`);
  } else {
    parts.push(`## History\n\n${para(...f.slice(0, 4))}`);
    if (f.length > 4) parts.push(`## Grands Prix\n\n${bullets(f.slice(4))}`);
  }
  return { title: sheet.title, body: parts.join("\n\n"), sources, aiGenerated: false, model: null };
}

export async function saveArticle(
  db: PrismaClient,
  type: EntityType,
  id: string,
  a: { title: string; body: string; sources: Source[]; aiGenerated: boolean; model: string | null },
) {
  const data = { title: a.title, body: a.body, sources: a.sources as unknown as object, aiGenerated: a.aiGenerated, model: a.model, lastEdited: new Date(), editedBy: a.aiGenerated ? "ai" : "template" };
  await db.article.upsert({
    where: { entityType_entityId: { entityType: type, entityId: id } },
    create: { entityType: type, entityId: id, ...data },
    update: data,
  });
}
