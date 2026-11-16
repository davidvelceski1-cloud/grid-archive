/** Chunking helpers for the RAG index (pure functions, unit-tested). */

export const MAX_CHUNK_CHARS = 1100;

/** Group self-contained fact lines into chunks of at most `max` characters. */
export function chunkFacts(facts: string[], max = MAX_CHUNK_CHARS): string[] {
  const out: string[] = [];
  let cur = "";
  for (const f of facts) {
    const pieces = f.length > max ? splitLong(f, max) : [f];
    for (const p of pieces) {
      if (cur && cur.length + p.length + 1 > max) {
        out.push(cur);
        cur = "";
      }
      cur = cur ? `${cur}\n${p}` : p;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** Split Markdown on "## " chapters, then on paragraphs, keeping the heading as context. */
export function chunkMarkdown(md: string, max = MAX_CHUNK_CHARS): string[] {
  const sections = md.split(/\n(?=## )/);
  const out: string[] = [];
  for (const section of sections) {
    const heading = section.match(/^## (.+)$/m)?.[1];
    const body = section.replace(/^## .+$/m, "").trim();
    const paras = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    let cur = "";
    const prefix = heading ? `${heading}: ` : "";
    for (const p of paras.flatMap((x) => (x.length > max ? splitLong(x, max) : [x]))) {
      if (cur && cur.length + p.length + 2 > max) {
        out.push(prefix + cur);
        cur = "";
      }
      cur = cur ? `${cur}\n\n${p}` : p;
    }
    if (cur) out.push(prefix + cur);
  }
  return out;
}

/** Split a long string on sentence boundaries (or hard-wrap as a last resort). */
export function splitLong(s: string, max: number): string[] {
  const sentences = s.match(/[^.;!?]+[.;!?]+(\s|$)|[^.;!?]+$/g) ?? [s];
  const out: string[] = [];
  let cur = "";
  for (const raw of sentences) {
    const sent = raw.trim();
    if (sent.length > max) {
      if (cur) { out.push(cur); cur = ""; }
      for (let i = 0; i < sent.length; i += max) out.push(sent.slice(i, i + max));
      continue;
    }
    if (cur && cur.length + sent.length + 1 > max) { out.push(cur); cur = ""; }
    cur = cur ? `${cur} ${sent}` : sent;
  }
  if (cur) out.push(cur);
  return out;
}
