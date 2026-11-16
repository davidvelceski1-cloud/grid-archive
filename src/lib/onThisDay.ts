/**
 * "On this day in F1 history": races held on today's date in past seasons and
 * drivers born today, plus an AI-written paragraph (cached daily) when configured.
 */
import { prisma } from "./db";
import { aiEnabled, completeText } from "./ai/claude";
import { formatDate } from "./text";

export interface OnThisDay {
  dateLabel: string;
  body: string | null;
  aiGenerated: boolean;
  races: { year: number; name: string; href: string; winner: string | null }[];
  birthdays: { name: string; href: string; year: number }[];
}

export async function getOnThisDay(now = new Date()): Promise<OnThisDay> {
  const m = now.getUTCMonth() + 1;
  const d = now.getUTCDate();
  const [races, birthdays] = await Promise.all([
    prisma.$queryRaw<{ year: number; name: string; slug: string; winner: string | null }[]>`
      SELECT r.year, r.name, r.slug, d."fullName" AS winner FROM "Race" r LEFT JOIN "Driver" d ON d.id = r."winnerDriverId"
      WHERE EXTRACT(MONTH FROM r.date) = ${m} AND EXTRACT(DAY FROM r.date) = ${d} AND r."winnerDriverId" IS NOT NULL
      ORDER BY r.year`,
    prisma.$queryRaw<{ fullName: string; slug: string; year: number; wins: number }[]>`
      SELECT "fullName", slug, EXTRACT(YEAR FROM "dateOfBirth")::int AS year, wins FROM "Driver"
      WHERE EXTRACT(MONTH FROM "dateOfBirth") = ${m} AND EXTRACT(DAY FROM "dateOfBirth") = ${d} AND starts > 0
      ORDER BY wins DESC, starts DESC LIMIT 6`,
  ]);
  const result: OnThisDay = {
    dateLabel: formatDate(now, { year: undefined }),
    body: null,
    aiGenerated: false,
    races: races.map((r) => ({ year: r.year, name: r.name, href: `/seasons/${r.year}/${r.slug}`, winner: r.winner })),
    birthdays: birthdays.map((b) => ({ name: b.fullName, href: `/drivers/${b.slug}`, year: b.year })),
  };
  if (!races.length && !birthdays.length) return result;

  const key = `otd-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}-${now.getUTCFullYear()}`;
  const cached = await prisma.dailyFeature.findUnique({ where: { key } });
  if (cached) return { ...result, body: cached.body, aiGenerated: cached.aiGenerated };
  if (!aiEnabled()) return result;

  try {
    const facts = [
      ...races.map((r) => `${r.year}: ${r.name} won by ${r.winner}`),
      ...birthdays.map((b) => `Born on this day in ${b.year}: ${b.fullName} (${b.wins} Grand Prix wins)`),
    ].join("\n");
    const body = await completeText({
      system: "You write the 'On this day in F1 history' note for GRID ARCHIVE. Use only the facts given; no invented details. 2–3 sentences, engaging museum-label tone, British English.",
      messages: [{ role: "user", content: `Date: ${result.dateLabel}\nFacts:\n${facts}` }],
      effort: "low",
      maxTokens: 500,
    });
    await prisma.dailyFeature.create({ data: { key, title: `On this day: ${result.dateLabel}`, body, aiGenerated: true } }).catch(() => {});
    return { ...result, body, aiGenerated: true };
  } catch {
    return result;
  }
}
