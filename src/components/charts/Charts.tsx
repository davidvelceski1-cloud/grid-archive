"use client";

/**
 * Archive charts (Recharts). Categorical series colours come from a validated
 * dark-surface palette (scripts: dataviz validate_palette — all checks pass on
 * #0B0D10). Colour follows the entity's slot, never its rank after filtering.
 * Every chart ships a hover tooltip, a legend for ≥2 series, direct end labels
 * (≤4 series), and a "View as table" alternative.
 */
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";

import { SERIES } from "@/lib/palette";

const AXIS = "#8b9097";
const GRID = "#22262c";
const TEXT_PRIMARY = "#f2f2f2";

function ChartFrame({ title, description, children, table }: { title: string; description?: string; children: React.ReactNode; table: React.ReactNode }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <figure className="border border-rule bg-carbon p-4 sm:p-6">
      <figcaption className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-bold text-white">{title}</p>
          {description && <p className="mt-1 text-sm text-mist">{description}</p>}
        </div>
        <button type="button" onClick={() => setAsTable((t) => !t)} className="chip" aria-pressed={asTable}>
          {asTable ? "View as chart" : "View as table"}
        </button>
      </figcaption>
      {asTable ? <div className="max-h-[420px] overflow-auto">{table}</div> : children}
    </figure>
  );
}

function DarkTooltip({ active, payload, label, labelPrefix = "" }: TooltipProps<number, string> & { labelPrefix?: string }) {
  if (!active || !payload?.length) return null;
  const rows = [...payload].filter((p) => p.value !== undefined && p.value !== null).sort((a, b) => Number(b.value) - Number(a.value));
  return (
    <div className="min-w-[180px] border border-rule bg-ink/95 px-3 py-2 text-sm shadow-xl">
      <p className="mb-1 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-mist">
        {labelPrefix}
        {label}
      </p>
      {rows.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-2 text-white/90">
            <span aria-hidden="true" className="inline-block h-2.5 w-2.5" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-bold tabular-nums text-white">{Number(p.value).toLocaleString("en-GB", { maximumFractionDigits: 1 })}</span>
        </p>
      ))}
    </div>
  );
}

export interface ProgressionSeries {
  id: string;
  name: string;
}

/** Cumulative championship points after each round. */
export function ProgressionChart({ rows, series, title, description }: { rows: Record<string, number | string>[]; series: ProgressionSeries[]; title: string; description?: string }) {
  const s = series.slice(0, SERIES.length);
  const last = rows.at(-1);
  const directLabels = s.length <= 4;
  return (
    <ChartFrame
      title={title}
      description={description}
      table={
        <table className="table-archive">
          <thead>
            <tr>
              <th scope="col">Round</th>
              {s.map((x) => <th key={x.id} scope="col" className="text-right">{x.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.round)}>
                <th scope="row" className="font-normal text-white/85">{String(r.label)}</th>
                {s.map((x) => <td key={x.id} className="text-right tabular-nums">{r[x.id] ?? "—"}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div className="h-[340px] sm:h-[400px]" role="img" aria-label={`${title}. Use "View as table" for the data.`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: directLabels ? 96 : 16, bottom: 4, left: -8 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="round" stroke={AXIS} tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} axisLine={{ stroke: GRID }} />
            <YAxis stroke={AXIS} tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} axisLine={false} width={48} />
            <Tooltip content={<DarkTooltip labelPrefix="After round " />} cursor={{ stroke: "#ffffff55", strokeWidth: 1 }} />
            <Legend wrapperStyle={{ color: TEXT_PRIMARY, fontSize: 12, paddingTop: 8 }} iconType="plainline" />
            {s.map((x, i) => (
              <Line
                key={x.id}
                type="monotone"
                dataKey={x.id}
                name={x.name}
                stroke={SERIES[i]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, stroke: "#0B0D10", strokeWidth: 2 }}
                connectNulls
                isAnimationActive={false}
                label={
                  directLabels
                    ? (props: { index?: number; x?: number; y?: number }) =>
                        props.index === rows.length - 1 && last?.[x.id] !== undefined ? (
                          <text key={x.id} x={(props.x ?? 0) + 8} y={(props.y ?? 0) + 4} fill={TEXT_PRIMARY} fontSize={12} fontWeight={600}>
                            {x.name.split(" ").at(-1)}
                          </text>
                        ) : (
                          <g key={`${x.id}-${props.index}`} />
                        )
                    : undefined
                }
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

/** Single-series bars: points per season, with championship position in the tooltip/table. */
export function SeasonBars({ rows, title, description }: { rows: { year: number; points: number; position: string }[]; title: string; description?: string }) {
  return (
    <ChartFrame
      title={title}
      description={description}
      table={
        <table className="table-archive">
          <thead><tr><th scope="col">Season</th><th scope="col" className="text-right">Points</th><th scope="col" className="text-right">Position</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.year}><th scope="row" className="font-normal">{r.year}</th><td className="text-right tabular-nums">{r.points}</td><td className="text-right">{r.position}</td></tr>)}</tbody>
        </table>
      }
    >
      <div className="h-[280px]" role="img" aria-label={`${title}. Use "View as table" for the data.`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 4, left: -8 }} barCategoryGap={2}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="year" stroke={AXIS} tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} axisLine={{ stroke: GRID }} />
            <YAxis stroke={AXIS} tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} axisLine={false} width={44} />
            <Tooltip
              cursor={{ fill: "#ffffff0d" }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="border border-rule bg-ink/95 px-3 py-2 text-sm">
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-mist">{label}</p>
                    <p className="font-bold text-white">{String(payload[0].value)} pts</p>
                    <p className="text-mist">Championship: {(payload[0].payload as { position: string }).position}</p>
                  </div>
                ) : null
              }
            />
            <Bar dataKey="points" name="Points" fill="#E4002B" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

/** 2–3 drivers: one metric per season (aligned by career year or calendar year). */
export function CompareLines({ rows, series, title, description, xLabel, reversed = false }: { rows: Record<string, number | string>[]; series: ProgressionSeries[]; title: string; description?: string; xLabel: string; reversed?: boolean }) {
  const s = series.slice(0, 3);
  return (
    <ChartFrame
      title={title}
      description={description}
      table={
        <table className="table-archive">
          <thead><tr><th scope="col">{xLabel}</th>{s.map((x) => <th key={x.id} scope="col" className="text-right">{x.name}</th>)}</tr></thead>
          <tbody>{rows.map((r) => <tr key={String(r.x)}><th scope="row" className="font-normal">{String(r.x)}</th>{s.map((x) => <td key={x.id} className="text-right tabular-nums">{r[x.id] ?? "—"}</td>)}</tr>)}</tbody>
        </table>
      }
    >
      <div className="h-[320px]" role="img" aria-label={`${title}. Use "View as table" for the data.`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: -8 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="x" stroke={AXIS} tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} axisLine={{ stroke: GRID }} />
            <YAxis stroke={AXIS} tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} axisLine={false} width={44} reversed={reversed} allowDecimals={false} domain={reversed ? [1, "dataMax"] : [0, "auto"]} />
            <Tooltip content={<DarkTooltip labelPrefix={`${xLabel} `} />} cursor={{ stroke: "#ffffff55" }} />
            <Legend wrapperStyle={{ color: TEXT_PRIMARY, fontSize: 12, paddingTop: 8 }} iconType="plainline" />
            {s.map((x, i) => (
              <Line key={x.id} type="monotone" dataKey={x.id} name={x.name} stroke={SERIES[i]} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: SERIES[i] }} activeDot={{ r: 5, stroke: "#0B0D10", strokeWidth: 2 }} connectNulls isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
