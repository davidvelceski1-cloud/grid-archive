import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { getLatestYear, thumb } from "@/lib/queries";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { DriversBrowser } from "@/components/browse/DriversBrowser";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Drivers",
  description: "Every driver who started a Formula 1 World Championship Grand Prix: A–Z index, champions, nationalities and decades.",
};

export default async function DriversPage() {
  const [drivers, latest] = await Promise.all([
    prisma.driver.findMany({ where: { starts: { gt: 0 } }, include: { image: true }, orderBy: { familyName: "asc" } }),
    getLatestYear(),
  ]);
  return (
    <div className="shell pb-20 pt-10">
      <Breadcrumbs items={[{ label: "Drivers" }]} />
      <p className="eyebrow-accent mt-10">Drivers archive</p>
      <h1 className="mt-3 text-display-xl">Drivers</h1>
      <div className="mb-10 mt-5 flex flex-wrap items-end justify-between gap-6">
        <p className="max-w-2xl text-lg text-white/80">
          {drivers.length} drivers have started a World Championship Grand Prix since 1950. Search, filter by nationality or decade, or browse the champions.
        </p>
        <Link href="/drivers/compare" className="btn-ghost">Compare drivers →</Link>
      </div>
      <Suspense fallback={<div className="skeleton h-12 w-full" />}>
        <DriversBrowser
          drivers={drivers.map((d) => ({
            slug: d.slug, name: d.fullName, family: d.familyName, search: d.searchName, nationality: d.nationality,
            firstYear: d.firstYear, lastYear: d.lastYear, starts: d.starts, wins: d.wins, titles: d.titles,
            active: d.lastYear === latest, image: thumb(d.image, 300),
          }))}
        />
      </Suspense>
    </div>
  );
}
