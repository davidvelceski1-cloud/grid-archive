"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Markdown } from "../Markdown";
import type { ArchivePageContext } from "./pageContext";

export interface ChatSource {
  n: number;
  title: string;
  url: string;
}
interface Msg {
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  error?: string;
  pending?: boolean;
}

const DEFAULT_SUGGESTIONS = [
  "Who won the 1976 championship and how?",
  "Which teams did Ayrton Senna drive for?",
  "Compare Lotus and Brabham in the 1970s",
  "What happened to Super Aguri?",
  "Who has the most wins at Monaco?",
  "Explain ground effect like I'm new to F1",
];

/** Split ```stats JSON blocks out of an answer so they render as stat cards. */
function splitStatBlocks(text: string): { md: string; stats: { label: string; value: string }[][] } {
  const stats: { label: string; value: string }[][] = [];
  const md = text.replace(/```stats\s*([\s\S]*?)```/g, (_, body: string) => {
    try {
      const parsed = JSON.parse(body);
      if (Array.isArray(parsed)) stats.push(parsed.slice(0, 6).map((s) => ({ label: String(s.label ?? ""), value: String(s.value ?? "") })));
    } catch {
      /* incomplete while streaming */
    }
    return "";
  });
  return { md, stats };
}

export function ChatPanel({ context, initialQuestion, compact = false }: { context?: ArchivePageContext | null; initialQuestion?: string; compact?: boolean }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [newcomer, setNewcomer] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const asked = useRef(false);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const history: Msg[] = [...messages.filter((m) => !m.error), { role: "user", content: q }];
    setMessages([...history, { role: "assistant", content: "", pending: true }]);
    setInput("");
    setBusy(true);
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
          context: context ? { type: context.type, id: context.id, title: context.title } : null,
          mode: newcomer ? "newcomer" : "standard",
        }),
      });
      if (!res.ok || !res.body) throw new Error((await res.text()) || `Request failed (${res.status})`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let text = "";
      let sources: ChatSource[] = [];
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as { type: string; text?: string; sources?: ChatSource[]; message?: string };
          if (ev.type === "sources") sources = ev.sources ?? [];
          if (ev.type === "text") text += ev.text ?? "";
          if (ev.type === "error") throw new Error(ev.message);
          setMessages([...history, { role: "assistant", content: text, sources, pending: ev.type !== "done" }]);
        }
      }
      setMessages([...history, { role: "assistant", content: text, sources }]);
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setMessages((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, pending: false } : x)));
      } else {
        setMessages([...history, { role: "assistant", content: "", error: (e as Error).message || "Something went wrong." }]);
      }
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }

  useEffect(() => {
    if (initialQuestion && !asked.current) {
      asked.current = true;
      void ask(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  const suggestions = context?.suggestions?.length ? context.suggestions : DEFAULT_SUGGESTIONS;

  return (
    <div className={`flex h-full min-h-0 flex-col ${compact ? "" : "border border-rule bg-carbon"}`}>
      <div ref={scroller} className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 sm:p-6" aria-live="polite" aria-busy={busy}>
        {messages.length === 0 && (
          <div>
            {context && (
              <p className="mb-3 text-sm text-mist">
                Asking about <span className="font-bold text-white">{context.title}</span>. Answers come from the archive and cite their sources.
              </p>
            )}
            {!context && <p className="mb-3 text-sm text-mist">Ask anything about seventy-five years of the World Championship. Every answer cites the archive pages it used.</p>}
            <p className="eyebrow mb-3">Try asking</p>
            <ul className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <li key={s}>
                  <button type="button" className="chip normal-case tracking-normal" onClick={() => ask(s)}>
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-auto max-w-[85%] bg-white px-4 py-3 text-[0.95rem] font-medium text-ink">
              {m.content}
            </div>
          ) : (
            <div key={i} className="max-w-full">
              <p className="eyebrow-accent mb-2">Archive answer</p>
              {m.error ? (
                <p className="border-l-2 border-signal pl-3 text-sm text-white/85">{m.error}</p>
              ) : (
                <>
                  {(() => {
                    const { md, stats } = splitStatBlocks(m.content);
                    return (
                      <>
                        {stats.map((row, j) => (
                          <dl key={j} className="mb-4 grid grid-cols-2 gap-px bg-rule sm:grid-cols-3">
                            {row.map((s) => (
                              <div key={s.label} className="bg-graphite p-3">
                                <dt className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-mist">{s.label}</dt>
                                <dd className="stat-num mt-1 text-2xl text-white">{s.value}</dd>
                              </div>
                            ))}
                          </dl>
                        ))}
                        <Markdown source={md} className="prose-dark" citations={m.sources?.map((s) => ({ url: s.url, title: s.title }))} />
                      </>
                    );
                  })()}
                  {m.pending && !m.content && (
                    <div className="space-y-2" aria-label="Thinking">
                      <div className="skeleton h-3 w-3/4" />
                      <div className="skeleton h-3 w-2/3" />
                      <div className="skeleton h-3 w-1/2" />
                    </div>
                  )}
                  {!!m.sources?.length && !m.pending && (
                    <div className="mt-4 border-t border-rule pt-3">
                      <p className="eyebrow mb-2">Sources in the archive</p>
                      <ol className="space-y-1 text-sm">
                        {m.sources.map((s) => (
                          <li key={s.n} className="flex gap-2">
                            <span className="w-6 shrink-0 font-bold text-signal-bright">[{s.n}]</span>
                            <Link href={s.url} className="link-quiet truncate text-white/85">
                              {s.title}
                            </Link>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </>
              )}
            </div>
          ),
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
        className="border-t border-rule p-3 sm:p-4"
      >
        <div className="flex items-end gap-2">
          <label htmlFor={compact ? "chat-input-widget" : "chat-input"} className="sr-only">
            Your question
          </label>
          <textarea
            id={compact ? "chat-input-widget" : "chat-input"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask(input);
              }
            }}
            rows={1}
            placeholder={context ? `Ask about ${context.title}…` : "Ask the archive…"}
            className="max-h-40 min-h-[48px] flex-1 resize-none border border-rule bg-ink px-3 py-3 text-[0.95rem] text-white placeholder:text-steel focus:border-white focus:outline-none"
          />
          {busy ? (
            <button type="button" onClick={() => abort.current?.abort()} className="btn-ghost h-12">
              Stop
            </button>
          ) : (
            <button type="submit" className="btn h-12" disabled={!input.trim()}>
              Ask
            </button>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-mist">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={newcomer} onChange={(e) => setNewcomer(e.target.checked)} className="accent-[#E4002B]" />
            Explain like I&apos;m new to F1
          </label>
          {messages.length > 0 && (
            <button type="button" onClick={() => setMessages([])} className="hover:text-white">
              Clear
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
