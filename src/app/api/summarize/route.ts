/**
 * POST /api/summarize {type, id, length: "short" | "detailed"}
 * AI summary of an archive page, cached in DailyFeature for 7 days.
 * Without an API key, returns a data-driven summary from the fact sheet.
 */
import { NextResponse } from "next/server";
import type { EntityType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { factSheetFor } from "@/lib/articles";
import { factsToText } from "@/lib/facts";
import { aiEnabled, completeText } from "@/lib/ai/claude";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TYPES = new Set(["SEASON", "DRIVER", "TEAM", "CIRCUIT"]);
const TTL = 7 * 24 * 3600_000;

export async function POST(req: Request) {
  const limited = rateLimit(req, "summarize", 15, 60_000);
  if (limited) return limited;
  const { type, id, length } = (await req.json().catch(() => ({}))) as { type?: string; id?: string; length?: string };
  if (!type || !TYPES.has(type) || !id) return NextResponse.json({ error: "type and id required" }, { status: 400 });
  const detailed = length === "detailed";
  const key = `sum-${type}-${id}-${detailed ? "d" : "s"}`;

  const cached = await prisma.dailyFeature.findUnique({ where: { key } });
  if (cached && Date.now() - cached.createdAt.getTime() < TTL) return NextResponse.json({ summary: cached.body, ai: cached.aiGenerated });

  const sheet = await factSheetFor(prisma, type as EntityType, id);
  if (!sheet) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (!aiEnabled()) {
    const summary = sheet.facts.slice(0, detailed ? 6 : 3).join(" ");
    return NextResponse.json({ summary, ai: false });
  }

  const article = await prisma.article.findUnique({ where: { entityType_entityId: { entityType: type as EntityType, entityId: id } } });
  const summary = await completeText({
    system:
      "You summarise pages of GRID ARCHIVE, an unofficial Formula 1 history archive. Use only the supplied material; never add facts. Plain prose, no headings.",
    messages: [
      {
        role: "user",
        content: `<facts>\n${factsToText(sheet)}\n</facts>\n<article>\n${article?.body.slice(0, 12000) ?? ""}\n</article>\n\nSummarise "${sheet.title}" in ${detailed ? "two short paragraphs (about 150 words)" : "two or three sentences (under 60 words)"}.`,
      },
    ],
    effort: "low",
    maxTokens: 1200,
  });
  await prisma.dailyFeature.upsert({
    where: { key },
    create: { key, title: sheet.title, body: summary, aiGenerated: true },
    update: { body: summary, aiGenerated: true, createdAt: new Date() },
  });
  return NextResponse.json({ summary, ai: true });
}
