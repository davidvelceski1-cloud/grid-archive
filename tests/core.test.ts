import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkFacts, chunkMarkdown, splitLong } from "../src/lib/ai/chunk";
import { ordinal, preciseAge, searchKey, slugify, formatPoints } from "../src/lib/text";
import { canonicalConstructor, LINEAGE } from "../data/curated/teams";
import { isAllowedLicense, titleFromUrl } from "../scripts/lib/wiki";
import { eraForYear, ERAS } from "../data/curated/eras";

test("slugify handles accents, apostrophes and ampersands", () => {
  assert.equal(slugify("Kimi Räikkönen"), "kimi-raikkonen");
  assert.equal(slugify("Autódromo José Carlos Pace"), "autodromo-jose-carlos-pace");
  assert.equal(slugify("70th Anniversary Grand Prix"), "70th-anniversary-grand-prix");
  assert.equal(slugify("Hesketh & Co."), "hesketh-and-co");
  assert.equal(searchKey("  Sergio  PÉREZ "), "sergio perez");
});

test("ordinal, points and precise ages", () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal), ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "101st"]);
  assert.equal(formatPoints(12), "12");
  assert.equal(formatPoints(4.5), "4.5");
  const age = preciseAge(new Date("1997-09-30T00:00:00Z"), new Date("2016-05-15T00:00:00Z"));
  assert.equal(age.years, 18);
  assert.equal(age.days, 228);
});

test("compound Jolpica constructor ids fold into one team", () => {
  assert.deepEqual(canonicalConstructor("brabham-repco"), { id: "brabham", engine: "Repco" });
  assert.deepEqual(canonicalConstructor("cooper-climax"), { id: "cooper", engine: "Climax" });
  assert.deepEqual(canonicalConstructor("lotus-climax"), { id: "team_lotus", engine: "Climax" });
  assert.deepEqual(canonicalConstructor("mclaren-alfa_romeo"), { id: "mclaren", engine: "Alfa Romeo" });
  assert.deepEqual(canonicalConstructor("behra-porsche"), { id: "behra-porsche", engine: null });
  assert.deepEqual(canonicalConstructor("red_bull"), { id: "red_bull", engine: null });
});

test("lineage edges are well-formed", () => {
  for (const e of LINEAGE) {
    assert.notEqual(e.from, e.to);
    assert.ok(e.year >= 1950 && e.year <= 2030, `${e.from}→${e.to}`);
  }
  // Tyrrell → BAR → Honda → Brawn → Mercedes is a connected chain
  const next = (id: string) => LINEAGE.find((e) => e.from === id)?.to;
  assert.deepEqual([next("tyrrell"), next("bar"), next("honda"), next("brawn")], ["bar", "honda", "brawn", "mercedes"]);
});

test("only free licences are accepted", () => {
  for (const ok of ["CC0", "Public domain", "PD-US", "CC BY 2.0", "CC BY-SA 4.0", "CC BY-SA 3.0"]) assert.ok(isAllowedLicense(ok), ok);
  for (const no of ["CC BY-NC 2.0", "CC BY-ND 4.0", "CC BY-NC-SA 3.0", "Fair use", "GFDL", "All rights reserved", ""]) assert.ok(!isAllowedLicense(no), no);
});

test("wikipedia titles are decoded from URLs", () => {
  assert.equal(titleFromUrl("http://en.wikipedia.org/wiki/Juan_Manuel_Fangio"), "Juan Manuel Fangio");
  assert.equal(titleFromUrl("https://en.wikipedia.org/wiki/Kimi_R%C3%A4ikk%C3%B6nen"), "Kimi Räikkönen");
  assert.equal(titleFromUrl("https://example.com/x"), null);
});

test("every season maps to exactly one era", () => {
  for (let y = 1950; y <= 2030; y++) assert.ok(eraForYear(y), String(y));
  assert.equal(eraForYear(1976), "wings-and-sponsorship");
  assert.equal(eraForYear(2026), "new-regulations");
  const sorted = [...ERAS].sort((a, b) => a.startYear - b.startYear);
  sorted.forEach((e, i) => i > 0 && assert.equal(e.startYear, sorted[i - 1].endYear! + 1));
});

test("chunking respects size limits and keeps chapter context", () => {
  const facts = Array.from({ length: 40 }, (_, i) => `Fact number ${i} about the 1976 season, which was dramatic.`);
  const chunks = chunkFacts(facts, 300);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((c) => c.length <= 300));
  assert.equal(chunks.join("\n").split("\n").length, 40);

  const md = "## Origins\n\nFirst paragraph.\n\nSecond paragraph.\n\n## Legacy\n\nThe end.";
  const mdChunks = chunkMarkdown(md);
  assert.deepEqual(mdChunks, ["Origins: First paragraph.\n\nSecond paragraph.", "Legacy: The end."]);

  const long = "A sentence. ".repeat(200);
  assert.ok(splitLong(long, 100).every((p) => p.length <= 100));
});

test("maximum points still available per weekend (title-clinch maths)", async () => {
  const { maxPointsPerWeekend } = await import("../scripts/lib/ingest");
  assert.deepEqual(maxPointsPerWeekend(2026, false), { driver: 25, constructor: 43 });
  assert.deepEqual(maxPointsPerWeekend(2026, true), { driver: 33, constructor: 58 });
  assert.deepEqual(maxPointsPerWeekend(2021, false), { driver: 26, constructor: 44 }); // fastest-lap point era
  // 2026 after round 20: Antonelli +111 with 3 non-sprint rounds left (max 75) → decided.
  assert.ok(111 > 3 * maxPointsPerWeekend(2026, false).driver);
  // Mercedes +140 over Ferrari with max 3 × 43 = 129 → decided.
  assert.ok(140 > 3 * maxPointsPerWeekend(2026, false).constructor);
});

test("edit distance used for misspelt names", async () => {
  const { levenshtein } = await import("../src/lib/ai/retrieval");
  assert.equal(levenshtein("tyrell", "tyrrell"), 1);
  assert.equal(levenshtein("verstapen", "verstappen"), 1);
  assert.equal(levenshtein("schumaker", "schumacher"), 2);
  assert.ok(levenshtein("banned", "brabham") > 2);
});
