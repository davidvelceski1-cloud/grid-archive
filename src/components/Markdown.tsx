/**
 * Minimal, safe Markdown renderer (no raw HTML) for archive articles and AI answers:
 * headings, paragraphs, lists, tables, blockquotes, **bold**, *italic*, `code`,
 * [links](/internal or https://external) and [n] citation markers.
 */
import Link from "next/link";
import type { ReactNode } from "react";

export interface CitationTarget {
  url: string;
  title: string;
}

function inline(text: string, citations?: CitationTarget[], keyBase = ""): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\[\d+(?:,\s*\d+)*\])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${keyBase}-${i++}`;
    if (tok.startsWith("**")) out.push(<strong key={k}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={k} className="bg-black/10 px-1 font-mono text-[0.9em]">{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("*")) out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    else if (/^\[\d/.test(tok)) {
      const nums = tok.slice(1, -1).split(",").map((n) => Number(n.trim()));
      out.push(
        <sup key={k} className="ml-0.5">
          {nums.map((n, j) => {
            const c = citations?.[n - 1];
            return c ? (
              <Link key={j} href={c.url} title={c.title} className="mx-px font-bold text-signal-bright no-underline hover:underline">
                [{n}]
              </Link>
            ) : (
              <span key={j}>[{n}]</span>
            );
          })}
        </sup>,
      );
    } else {
      const lm = tok.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)!;
      const href = lm[2];
      const safe = /^(https?:\/\/|\/|#)/.test(href) ? href : "#";
      out.push(
        safe.startsWith("/") || safe.startsWith("#") ? (
          <Link key={k} href={safe}>{lm[1]}</Link>
        ) : (
          <a key={k} href={safe} rel="noopener noreferrer" target="_blank">{lm[1]}</a>
        ),
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source, className = "", citations }: { source: string; className?: string; citations?: CitationTarget[] }) {
  const lines = source.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const h = line.match(/^(#{2,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const text = h[2].trim();
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      blocks.push(level === 2 ? <h2 key={key++} id={id}>{inline(text, citations)}</h2> : <h3 key={key++} id={id}>{inline(text, citations)}</h3>);
      i++;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push(<blockquote key={key++}>{inline(quote.join(" "), citations)}</blockquote>);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ""));
      blocks.push(<ul key={key++}>{items.map((t, j) => <li key={j}>{inline(t, citations, `${key}-${j}`)}</li>)}</ul>);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+\.\s+/, ""));
      blocks.push(<ol key={key++}>{items.map((t, j) => <li key={j}>{inline(t, citations, `${key}-${j}`)}</li>)}</ol>);
      continue;
    }
    if (/^\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
      blocks.push(
        <div key={key++} className="overflow-x-auto">
          <table>
            <thead><tr>{head.map((c, j) => <th key={j}>{inline(c, citations)}</th>)}</tr></thead>
            <tbody>{rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k}>{inline(c, citations)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{2,4}\s|>|\s*[-*]\s|\s*\d+\.\s|\|)/.test(lines[i])) para.push(lines[i++]);
    if (para.length) blocks.push(<p key={key++}>{inline(para.join(" "), citations)}</p>);
    else i++;
  }
  return <div className={className}>{blocks}</div>;
}

/** Split an article into chapters on "## " headings (for the chapter nav). */
export function chaptersOf(md: string): { id: string; title: string }[] {
  return [...md.matchAll(/^##\s+(.+)$/gm)].map((m) => ({
    title: m[1].trim(),
    id: m[1].trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  }));
}
