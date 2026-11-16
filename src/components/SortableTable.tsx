"use client";

import { useMemo, useState, type ReactNode } from "react";

export interface Column {
  label: string;
  numeric?: boolean;
  className?: string;
}
export interface Row {
  key: string;
  cells: ReactNode[];
  sort: (string | number | null)[];
  highlight?: boolean;
}

/** Accessible sortable table; cells are pre-rendered on the server, sort keys are plain values. */
export function SortableTable({ columns, rows, caption, initialSort = 0, initialDir = "asc", dense = false }: { columns: Column[]; rows: Row[]; caption: string; initialSort?: number; initialDir?: "asc" | "desc"; dense?: boolean }) {
  const [sort, setSort] = useState<{ col: number; dir: "asc" | "desc" }>({ col: initialSort, dir: initialDir });
  const sorted = useMemo(() => {
    const r = [...rows];
    r.sort((a, b) => {
      const x = a.sort[sort.col];
      const y = b.sort[sort.col];
      if (x === y) return 0;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return sort.dir === "asc" ? c : -c;
    });
    return r;
  }, [rows, sort]);

  return (
    <div className="overflow-x-auto">
      <table className={`table-archive ${dense ? "text-[0.82rem]" : ""}`}>
        <caption className="sr-only">{caption}. Column headers are buttons that sort the table.</caption>
        <thead>
          <tr>
            {columns.map((c, i) => {
              const active = sort.col === i;
              return (
                <th key={c.label} scope="col" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={`${c.numeric ? "text-right" : ""} ${c.className ?? ""}`}>
                  <button
                    type="button"
                    onClick={() => setSort({ col: i, dir: active && sort.dir === (c.numeric ? "desc" : "asc") ? (c.numeric ? "asc" : "desc") : c.numeric ? "desc" : "asc" })}
                    className={`inline-flex items-center gap-1 uppercase tracking-[0.14em] hover:text-white ${active ? "text-white" : ""}`}
                  >
                    {c.label}
                    <span aria-hidden="true" className={active ? "text-signal-bright" : "opacity-30"}>{active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}</span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.key} className={r.highlight ? "bg-signal/10" : undefined}>
              {r.cells.map((cell, i) => (
                <td key={i} className={`${columns[i]?.numeric ? "text-right tabular-nums" : ""} ${columns[i]?.className ?? ""}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
