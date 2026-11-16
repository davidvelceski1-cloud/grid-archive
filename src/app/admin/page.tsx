import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/text";
import { saveSeasonAction, saveTeamAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

const TABS = ["overview", "articles", "teams", "seasons"] as const;

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; saved?: string }> }) {
  const sp = await searchParams;
  const tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? sp.tab! : "overview";
  const q = sp.q?.trim() ?? "";

  return (
    <div className="shell pb-20 pt-10">
      <p className="eyebrow-accent">Editorial</p>
      <h1 className="mt-2 text-display-md">Admin</h1>
      <nav className="mt-6 flex gap-2" aria-label="Admin sections">
        {TABS.map((t) => <Link key={t} href={`/admin?tab=${t}`} className="chip" aria-pressed={tab === t}>{t}</Link>)}
      </nav>
      {sp.saved && <p className="mt-4 border-l-2 border-signal pl-3 text-sm">Saved {sp.saved}.</p>}
      <div className="mt-10">
        {tab === "overview" && <Overview />}
        {tab === "articles" && <Articles q={q} />}
        {tab === "teams" && <Teams q={q} />}
        {tab === "seasons" && <Seasons />}
      </div>
    </div>
  );
}

async function Overview() {
  const [runs, counts] = await Promise.all([
    prisma.ingestRun.findMany({ orderBy: { startedAt: "desc" }, take: 12 }),
    Promise.all([prisma.season.count(), prisma.race.count(), prisma.driver.count(), prisma.team.count(), prisma.article.count(), prisma.article.count({ where: { aiGenerated: true } }), prisma.image.count(), prisma.embedding.count()]),
  ]);
  const labels = ["Seasons", "Races", "Drivers", "Constructors", "Articles", "AI articles", "Images", "RAG chunks"];
  return (
    <div className="space-y-10">
      <dl className="grid grid-cols-2 gap-px bg-rule sm:grid-cols-4">
        {labels.map((l, i) => <div key={l} className="bg-carbon p-4"><dt className="eyebrow">{l}</dt><dd className="stat-num mt-1 text-3xl">{counts[i]}</dd></div>)}
      </dl>
      <section>
        <h2 className="mb-3 text-xl font-bold">Data jobs</h2>
        <p className="mb-4 text-sm text-mist">The current season updates automatically every Monday via <code>/api/cron/update</code> (Vercel Cron). Run <code>npm run update:current</code> to update manually; it also refreshes the vector index.</p>
        <table className="table-archive">
          <thead><tr><th scope="col">Job</th><th scope="col">Started</th><th scope="col">Status</th><th scope="col">Message</th></tr></thead>
          <tbody>{runs.map((r) => <tr key={r.id}><td>{r.job}</td><td>{formatDate(r.startedAt)} {r.startedAt.toISOString().slice(11, 16)}</td><td className={r.ok ? "text-white" : "text-signal-bright"}>{r.ok ? "OK" : r.finishedAt ? "Failed" : "Running"}</td><td className="text-mist">{r.message}</td></tr>)}</tbody>
        </table>
      </section>
    </div>
  );
}

async function Articles({ q }: { q: string }) {
  const articles = await prisma.article.findMany({
    where: q ? { title: { contains: q, mode: "insensitive" } } : undefined,
    orderBy: { lastEdited: "desc" },
    take: 100,
    select: { id: true, title: true, entityType: true, aiGenerated: true, editedBy: true, lastEdited: true },
  });
  return (
    <div>
      <form className="mb-6 flex gap-2"><input type="hidden" name="tab" value="articles" /><input name="q" defaultValue={q} placeholder="Find article…" className="border border-rule bg-carbon px-3 py-2" /><button className="btn py-2">Find</button></form>
      <table className="table-archive">
        <thead><tr><th scope="col">Title</th><th scope="col">Type</th><th scope="col">Source</th><th scope="col">Edited</th></tr></thead>
        <tbody>
          {articles.map((a) => (
            <tr key={a.id}>
              <td><Link href={`/admin/articles/${a.id}`} className="link">{a.title}</Link></td>
              <td>{a.entityType}</td>
              <td>{a.aiGenerated ? "AI-assisted" : "Template"}{a.editedBy === "admin" ? " · edited" : ""}</td>
              <td className="text-mist">{formatDate(a.lastEdited)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function Teams({ q }: { q: string }) {
  const teams = await prisma.team.findMany({ where: { entries: { gt: 0 }, ...(q ? { searchName: { contains: q.toLowerCase() } } : {}) }, orderBy: { entries: "desc" }, take: q ? 20 : 12 });
  return (
    <div>
      <form className="mb-6 flex gap-2"><input type="hidden" name="tab" value="teams" /><input name="q" defaultValue={q} placeholder="Find team…" className="border border-rule bg-carbon px-3 py-2" /><button className="btn py-2">Find</button></form>
      <div className="space-y-6">
        {teams.map((t) => (
          <form key={t.id} action={saveTeamAction} className="grid gap-3 border border-rule p-4 sm:grid-cols-4">
            <input type="hidden" name="id" value={t.id} />
            <p className="font-display text-xl font-bold sm:col-span-4">{t.name} <span className="text-sm font-normal text-mist">({t.firstYear}–{t.lastYear}, {t.status})</span></p>
            <label className="text-sm">Founded<input name="founded" type="number" defaultValue={t.founded ?? ""} className="mt-1 w-full border border-rule bg-ink px-2 py-1" /></label>
            <label className="text-sm">Base<input name="base" defaultValue={t.base ?? ""} className="mt-1 w-full border border-rule bg-ink px-2 py-1" /></label>
            <label className="text-sm">Founder<input name="founder" defaultValue={t.founder ?? ""} className="mt-1 w-full border border-rule bg-ink px-2 py-1" /></label>
            <label className="text-sm">Colour<input name="color" type="color" defaultValue={t.color} className="mt-1 block h-8 w-full border border-rule bg-ink" /></label>
            <label className="text-sm sm:col-span-4">Why they disappeared<textarea name="whyDisappeared" defaultValue={t.whyDisappeared ?? ""} rows={2} className="mt-1 w-full border border-rule bg-ink px-2 py-1" /></label>
            <button className="btn w-fit py-2">Save {t.name}</button>
          </form>
        ))}
      </div>
    </div>
  );
}

async function Seasons() {
  const seasons = await prisma.season.findMany({ orderBy: { year: "desc" }, select: { year: true, headline: true, headlineAuto: true } });
  return (
    <div className="space-y-2">
      <p className="mb-4 text-sm text-mist">Leave a headline empty to restore the automatic data-driven headline.</p>
      {seasons.map((s) => (
        <form key={s.year} action={saveSeasonAction} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="year" value={s.year} />
          <span className="stat-num w-14 text-xl">{s.year}</span>
          <input name="headline" defaultValue={s.headlineAuto ? "" : s.headline ?? ""} placeholder={s.headline ?? ""} className="min-w-0 flex-1 border border-rule bg-carbon px-3 py-2 text-sm" />
          <button className="chip">Save</button>
        </form>
      ))}
    </div>
  );
}
