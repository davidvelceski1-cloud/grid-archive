import type { Metadata } from "next";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { thumb } from "@/lib/queries";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { TeamsBrowser } from "@/components/browse/TeamsBrowser";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Teams",
  description: "Every constructor that entered a Formula 1 World Championship race, active and defunct, with lineage, statistics and history.",
};

export default async function TeamsPage() {
  const teams = await prisma.team.findMany({ where: { entries: { gt: 0 } }, include: { image: true }, orderBy: { entries: "desc" } });
  const active = teams.filter((t) => t.status === "ACTIVE").length;
  return (
    <div className="shell pb-20 pt-10">
      <Breadcrumbs items={[{ label: "Teams" }]} />
      <p className="eyebrow-accent mt-10">Constructors archive</p>
      <h1 className="mt-3 text-display-xl">Teams</h1>
      <p className="mb-10 mt-5 max-w-2xl text-lg text-white/80">
        {teams.length} constructors have started a World Championship Grand Prix. {active} are on today&apos;s grid; the rest were sold, renamed or lost.
      </p>
      <Suspense fallback={<div className="skeleton h-12 w-full" />}>
        <TeamsBrowser
          teams={teams.map((t) => ({
            slug: t.slug, name: t.name, search: t.searchName, nationality: t.nationality, color: t.color, status: t.status,
            firstYear: t.firstYear, lastYear: t.lastYear, entries: t.entries, wins: t.wins, titles: t.constructorTitles + t.driverTitles, image: thumb(t.image, 600), imageAlt: t.image?.alt ?? null,
          }))}
        />
      </Suspense>
    </div>
  );
}
