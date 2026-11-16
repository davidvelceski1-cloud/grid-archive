import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { formatDate } from "@/lib/text";

export const revalidate = 3600;
export const metadata: Metadata = { title: "About", description: "About GRID ARCHIVE: data sources, AI use, licences and the unofficial-project disclaimer." };

export default async function AboutPage() {
  const [lastRun, aiArticles, articles] = await Promise.all([
    prisma.ingestRun.findFirst({ where: { ok: true }, orderBy: { finishedAt: "desc" } }),
    prisma.article.count({ where: { aiGenerated: true } }),
    prisma.article.count(),
  ]);
  return (
    <div className="shell pb-20 pt-10">
      <Breadcrumbs items={[{ label: "About" }]} />
      <p className="eyebrow-accent mt-10">About the project</p>
      <h1 className="mt-3 text-display-lg">A museum of motor racing, open to everyone</h1>
      <div className="prose-dark mt-10 max-w-3xl">
        <p>
          GRID ARCHIVE is an encyclopedic, year-by-year archive of the Formula 1 World Championship, from the first championship race at Silverstone in 1950 to the current season. Every season, team, driver and circuit has its own page, and every name links to its own page.
        </p>
        <h2 id="data">Data sources</h2>
        <ul>
          <li><strong>Results, standings, qualifying</strong>: the <a href="https://api.jolpi.ca/ergast/">Jolpica-F1 API</a>, the community successor to the Ergast database, imported into our own database and refreshed after each race weekend{lastRun?.finishedAt ? ` (last update ${formatDate(lastRun.finishedAt)})` : ""}.</li>
          <li><strong>Background text</strong>: lead sections of Wikipedia articles, licensed CC BY-SA 4.0 and attributed on every page that uses them.</li>
          <li><strong>Images</strong>: Wikimedia Commons, free licences only. See <Link href="/credits">image credits</Link>.</li>
          <li><strong>Maps</strong>: © OpenStreetMap contributors.</li>
          <li><strong>Curated data</strong>: team lineages, era overviews, regulation changes, the car register and the glossary are maintained by the archive&apos;s editors.</li>
        </ul>
        <p>Known gaps: fastest-lap data is complete only from 2004. Pole positions before qualifying records exist are taken from the starting grid. The car register covers championship-winning and landmark cars and is being extended.</p>
        <h2 id="ai">AI and accuracy</h2>
        <p>
          {aiArticles} of {articles} long-form articles are marked <em>AI-assisted</em>. They were drafted by a large language model using only the archive&apos;s structured data and the attributed Wikipedia lead section, and can be corrected by editors. Pages without AI drafts use text assembled directly from the data.
        </p>
        <p>
          <Link href="/ask">Ask the Archive</Link> uses retrieval-augmented generation: the assistant first retrieves relevant passages from this archive, then answers only from them, with numbered citations. It is instructed to say when the archive does not contain an answer. AI can still make mistakes, so check the cited pages.
        </p>
        <h2 id="disclaimer">Disclaimer</h2>
        <p>
          GRID ARCHIVE is an unofficial fan project and is not affiliated with Formula 1, the FIA, or any team. F1, FORMULA ONE, FORMULA 1 and related marks are trademarks of Formula One Licensing B.V. No official logos are used.
        </p>
      </div>
    </div>
  );
}
