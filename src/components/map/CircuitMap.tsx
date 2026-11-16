"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, CircleMarker, Popup, TileLayer } from "react-leaflet";

export interface MapCircuit {
  slug: string;
  name: string;
  country: string | null;
  lat: number;
  lng: number;
  races: number;
  active: boolean;
  years: string;
}

/** World map of every circuit (OpenStreetMap tiles). Red = on the current calendar. */
export default function CircuitMap({ circuits, height = 520 }: { circuits: MapCircuit[]; height?: number }) {
  const bounds = circuits.length ? L.latLngBounds(circuits.map((c) => [c.lat, c.lng] as [number, number])).pad(0.1) : undefined;
  return (
    <div style={{ height }} className="relative border border-rule">
      <MapContainer bounds={bounds} center={[30, 10]} zoom={2} minZoom={2} worldCopyJump scrollWheelZoom={false} style={{ height: "100%", width: "100%" }} attributionControl>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map-tiles"
        />
        {circuits.map((c) => (
          <CircleMarker
            key={c.slug}
            center={[c.lat, c.lng]}
            radius={Math.min(14, 4 + Math.sqrt(c.races))}
            pathOptions={{ color: "#0B0D10", weight: 2, fillColor: c.active ? "#E4002B" : "#B0B4BA", fillOpacity: 0.95 }}
          >
            <Popup>
              <strong>{c.name}</strong>
              <br />
              {c.country} · {c.races} Grands Prix ({c.years})
              <br />
              <a href={`/circuits/${c.slug}`}>Open circuit page →</a>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <div className="pointer-events-none absolute bottom-3 left-3 z-[400] flex gap-4 bg-ink/85 px-3 py-2 text-xs text-white">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-signal" aria-hidden="true" /> Current calendar</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-mist" aria-hidden="true" /> Historic</span>
        <span className="text-mist">Marker size = races held</span>
      </div>
    </div>
  );
}
