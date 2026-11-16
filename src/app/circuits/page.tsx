import type { Metadata } from "next";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { thumb } from "@/lib/queries";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CircuitMapLoader } from "@/components/map/CircuitMapLoader";
import { CircuitsBrowser } from "@/components/browse/CircuitsBrowser";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Circuits",
  description: "Every circuit used in the Formula 1 World Championship on an interactive world map, with layouts, lap records and every Grand Prix held.",
};

export default async function CircuitsPage() {
  const circuits = await prisma.circuit.findMany({ where: { raceCount: { gt: 0 } }, include: { image: true, trackMap: true }, orderBy: { raceCount: "desc" } });
  const active = circuits.filter((c) => c.isActive).length;
  return (
    <div className="shell pb-20 pt-10">
      <Breadcrumbs items={[{ label: "Circuits" }]} />
      <p className="eyebrow-accent mt-10">Circuits archive</p>
      <h1 className="mt-3 text-display-xl">Circuits</h1>
      <p className="mb-10 mt-5 max-w-2xl text-lg text-white/80">
        {circuits.length} venues have hosted a World Championship Grand Prix; {active} are on the current calendar. Select a marker to open a circuit.
      </p>
      <CircuitMapLoader
        circuits={circuits
          .filter((c) => c.lat !== null && c.lng !== null)
          .map((c) => ({ slug: c.slug, name: c.name, country: c.country, lat: c.lat!, lng: c.lng!, races: c.raceCount, active: c.isActive, years: `${c.firstYear}–${c.lastYear}` }))}
      />
      <div className="mt-14">
        <Suspense fallback={<div className="skeleton h-12" />}>
          <CircuitsBrowser
            circuits={circuits.map((c) => ({
              slug: c.slug, name: c.name, locality: c.locality, country: c.country, type: c.type, active: c.isActive,
              races: c.raceCount, firstYear: c.firstYear, lastYear: c.lastYear, image: thumb(c.image, 600), map: c.trackMap?.path ?? null,
            }))}
          />
        </Suspense>
      </div>
    </div>
  );
}
