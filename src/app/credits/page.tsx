import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { thumb } from "@/lib/queries";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export const revalidate = 86400;
export const metadata: Metadata = { title: "Image credits", description: "Credits and licences for every image in GRID ARCHIVE, sourced from Wikimedia Commons." };

const KIND = { DRIVER: "Driver portraits", TEAM: "Team cars", CAR: "Cars", CIRCUIT: "Circuit photographs", TRACK_MAP: "Track maps" } as const;

export default async function CreditsPage() {
  const images = await prisma.image.findMany({ orderBy: [{ kind: "asc" }, { alt: "asc" }] });
  const byKind = Object.entries(KIND).map(([k, label]) => ({ label, list: images.filter((i) => i.kind === k) })).filter((g) => g.list.length);
  const licences = new Map<string, number>();
  for (const i of images) licences.set(i.license, (licences.get(i.license) ?? 0) + 1);
  return (
    <div className="shell pb-20 pt-10">
      <Breadcrumbs items={[{ label: "Image credits" }]} />
      <p className="eyebrow-accent mt-10">Attribution</p>
      <h1 className="mt-3 text-display-lg">Image credits</h1>
      <div className="mt-5 max-w-3xl space-y-3 text-lg text-white/80">
        <p>
          Every photograph and track map in GRID ARCHIVE comes from <a href="https://commons.wikimedia.org" className="link">Wikimedia Commons</a> and is used under a free licence: CC0, Public Domain, CC BY or CC BY-SA. Images were matched to drivers, teams and circuits through their Wikidata records, then resized; no other changes were made.
        </p>
        <p className="text-base text-mist">
          No official logos of Formula 1, the FIA or any team are used. Team identities are shown as styled text in team colours. If you are a rights holder and believe an image is credited incorrectly, follow the source link to its Commons page.
        </p>
      </div>
      <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div><dt className="eyebrow">Images</dt><dd className="stat-num text-3xl">{images.length}</dd></div>
        {[...licences].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([l, n]) => (
          <div key={l}><dt className="eyebrow">{l}</dt><dd className="stat-num text-3xl">{n}</dd></div>
        ))}
      </dl>
      {byKind.map((g) => (
        <section key={g.label} className="mt-14" aria-label={g.label}>
          <h2 className="mb-4 text-2xl font-bold">{g.label}</h2>
          <div className="overflow-x-auto">
            <table className="table-archive text-[0.85rem]">
              <thead><tr><th scope="col">Image</th><th scope="col">Subject</th><th scope="col">Author</th><th scope="col">Licence</th><th scope="col">Source</th></tr></thead>
              <tbody>
                {g.list.map((i) => (
                  <tr key={i.id}>
                    <td className="w-20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={thumb(i, 300) ?? i.path} alt="" loading="lazy" className="h-12 w-16 bg-white/5 object-cover" />
                    </td>
                    <td>{i.alt}</td>
                    <td className="max-w-xs text-white/80">{i.author}</td>
                    <td>{i.licenseUrl ? <a href={i.licenseUrl} className="link" rel="license noopener" target="_blank">{i.license}</a> : i.license}</td>
                    <td><a href={i.sourceUrl} className="link" rel="noopener" target="_blank">{i.commonsFile.slice(0, 48)}</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {!images.length && <p className="mt-10 text-mist">No images have been ingested yet. Run <code>npm run images:ingest</code>.</p>}
      <p className="mt-14 text-sm text-mist">Map data © <Link href="https://www.openstreetmap.org/copyright" className="link">OpenStreetMap contributors</Link>.</p>
    </div>
  );
}
