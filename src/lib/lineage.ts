/** Builds a team's ownership/name lineage (connected component of ConstructorLineage edges). */
import { prisma } from "./db";

export interface LineageStage {
  id: string;
  slug: string;
  name: string;
  color: string;
  from: number | null;
  to: number | null;
  kindIn?: string;
  noteIn?: string | null;
}

export interface Lineage {
  stages: LineageStage[]; // linear chain in time order (empty if no lineage)
  edges: { from: string; to: string; year: number; kind: string; note: string | null }[];
  linear: boolean;
}

export async function getLineage(teamId: string): Promise<Lineage> {
  const all = await prisma.constructorLineage.findMany();
  const seen = new Set([teamId]);
  const queue = [teamId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const e of all) {
      for (const [a, b] of [[e.predecessorId, e.successorId], [e.successorId, e.predecessorId]]) {
        if (a === cur && !seen.has(b)) {
          seen.add(b);
          queue.push(b);
        }
      }
    }
  }
  const edges = all.filter((e) => seen.has(e.predecessorId)).sort((a, b) => a.year - b.year);
  if (!edges.length) return { stages: [], edges: [], linear: true };
  const teams = new Map((await prisma.team.findMany({ where: { id: { in: [...seen] } } })).map((t) => [t.id, t]));
  const linear = edges.every((e, i) => i === 0 || edges[i - 1].successorId === e.predecessorId);
  const stages: LineageStage[] = [];
  if (linear) {
    const first = teams.get(edges[0].predecessorId)!;
    stages.push({ id: first.id, slug: first.slug, name: first.name, color: first.color, from: first.firstYear, to: edges[0].year - 1 });
    edges.forEach((e, i) => {
      const t = teams.get(e.successorId)!;
      const end = edges[i + 1] ? edges[i + 1].year - 1 : t.lastYear;
      stages.push({ id: t.id, slug: t.slug, name: t.name, color: t.color, from: e.year, to: t.status === "ACTIVE" && !edges[i + 1] ? null : end, kindIn: e.kind, noteIn: e.note });
    });
  }
  return {
    stages,
    linear,
    edges: edges.map((e) => ({ from: teams.get(e.predecessorId)!.name, to: teams.get(e.successorId)!.name, year: e.year, kind: e.kind, note: e.note })),
  };
}
