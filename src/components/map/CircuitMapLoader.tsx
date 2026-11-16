"use client";

import dynamic from "next/dynamic";
import type { MapCircuit } from "./CircuitMap";

const CircuitMap = dynamic(() => import("./CircuitMap"), {
  ssr: false,
  loading: () => <div className="skeleton h-[520px] w-full" aria-label="Loading map" />,
});

export function CircuitMapLoader(props: { circuits: MapCircuit[]; height?: number }) {
  return <CircuitMap {...props} />;
}
