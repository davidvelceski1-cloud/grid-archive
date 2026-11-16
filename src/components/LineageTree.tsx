import Link from "next/link";
import type { Lineage } from "@/lib/lineage";

/** Horizontal lineage diagram, e.g. Tyrrell → BAR → Honda → Brawn → Mercedes. */
export function LineageTree({ lineage, currentId }: { lineage: Lineage; currentId: string }) {
  if (!lineage.edges.length) return null;
  if (!lineage.linear) {
    return (
      <ol className="space-y-2">
        {lineage.edges.map((e, i) => (
          <li key={i} className="text-white/90">
            <span className="stat-num mr-3 text-signal-bright">{e.year}</span>
            {e.from} → <strong>{e.to}</strong> <span className="text-mist">({e.kind}{e.note ? `: ${e.note}` : ""})</span>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <div className="no-scrollbar overflow-x-auto pb-2">
      <ol className="flex min-w-max items-stretch" aria-label="Team lineage, oldest first">
        {lineage.stages.map((s, i) => {
          const current = s.id === currentId;
          return (
            <li key={`${s.id}-${i}`} className="flex items-stretch">
              {i > 0 && (
                <div className="flex w-24 flex-col items-center justify-center px-1 text-center" aria-hidden="false">
                  <span className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-mist">{s.kindIn}</span>
                  <span className="my-1 flex w-full items-center">
                    <span className="h-px flex-1 bg-mist" />
                    <span className="text-mist">▶</span>
                  </span>
                  <span className="stat-num text-sm text-white">{s.from}</span>
                </div>
              )}
              <Link
                href={`/teams/${s.slug}`}
                aria-current={current ? "page" : undefined}
                title={s.noteIn ?? undefined}
                className={`flex w-44 flex-col justify-between border p-4 transition-colors ${current ? "border-signal bg-signal/15" : "border-rule bg-carbon hover:border-white"}`}
              >
                <span className="block h-1 w-10" style={{ background: s.color }} aria-hidden="true" />
                <span className="mt-3 font-display text-lg font-bold leading-tight text-white">{s.name}</span>
                <span className="mt-2 text-xs tabular-nums text-mist">
                  {s.from ?? "?"}–{s.to ?? "today"}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
