import { ImageResponse } from "next/og";

export const alt = "GRID ARCHIVE — The Formula 1 history archive";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Default Open Graph card (pages inherit it unless they define their own). */
export default function OgImage() {
  const cells = [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => ({ r, c, on: (r + c) % 2 === 0 })));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#000", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, color: "#fff", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 72, height: 72, display: "flex", flexWrap: "wrap", padding: 9, background: "#000", border: "2px solid #333" }}>
            {cells.map((x) => <div key={`${x.r}${x.c}`} style={{ width: 18, height: 18, background: x.on ? "#fff" : "#000" }} />)}
          </div>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 800, letterSpacing: 4 }}>GRID<span style={{ color: "#B0B4BA", fontWeight: 500 }}>ARCHIVE</span></div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 22, letterSpacing: 6, color: "#FF5A72", fontWeight: 700 }}>1950 — TODAY</div>
          <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 1, letterSpacing: -3, marginTop: 16 }}>The Formula 1 history archive</div>
        </div>
        <div style={{ height: 8, width: 240, background: "#E4002B" }} />
      </div>
    ),
    size,
  );
}
