/**
 * GET /api/explain?term=DRS — "Explain like I'm new to F1".
 * Glossary terms answer instantly from the curated ELI5 text; other terms are
 * explained by Claude (cached) when an API key is configured.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { aiEnabled, completeText } from "@/lib/ai/claude";
import { rateLimit } from "@/lib/rateLimit";
import { slugify } from "@/lib/text";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const term = new URL(req.url).searchParams.get("term")?.trim().slice(0, 60);
  if (!term) return NextResponse.json({ error: "term required" }, { status: 400 });

  const g =
    (await prisma.glossaryTerm.findUnique({ where: { slug: slugify(term) } })) ??
    (await prisma.glossaryTerm.findFirst({ where: { term: { contains: term, mode: "insensitive" } } }));
  if (g) return NextResponse.json({ term: g.term, explanation: g.eli5, source: "glossary" });

  const limited = rateLimit(req, "explain", 20, 60_000);
  if (limited) return limited;
  const key = `eli5-${slugify(term)}`;
  const cached = await prisma.dailyFeature.findUnique({ where: { key } });
  if (cached) return NextResponse.json({ term, explanation: cached.body, source: "ai" });
  if (!aiEnabled()) return NextResponse.json({ term, explanation: null, source: "none" });

  const explanation = await completeText({
    system:
      "You explain Formula 1 terms to complete newcomers in 2–3 friendly, plain sentences, like explaining to a curious 12-year-old. If the term is not a Formula 1 or motorsport term, say you can only explain F1 terms.",
    messages: [{ role: "user", content: `Explain: ${term}` }],
    effort: "low",
    maxTokens: 400,
  });
  await prisma.dailyFeature.create({ data: { key, title: term, body: explanation, aiGenerated: true } }).catch(() => {});
  return NextResponse.json({ term, explanation, source: "ai" });
}
