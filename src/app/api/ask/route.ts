/**
 * POST /api/ask: retrieval-augmented chat over the archive.
 * Streams NDJSON events: {type:"sources"} → {type:"text"}* → {type:"done"} | {type:"error"}.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { aiEnabled, streamText } from "@/lib/ai/claude";
import { ASK_SYSTEM, NEWCOMER_ADDENDUM, buildSources, extractiveAnswer, sourcesBlock } from "@/lib/ai/answer";
import type { PageContext } from "@/lib/ai/retrieval";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Body {
  messages: { role: "user" | "assistant"; content: string }[];
  context?: { type: PageContext["type"]; id: string; title?: string } | null;
  mode?: "standard" | "newcomer";
}

const VALID_TYPES = new Set(["SEASON", "RACE", "DRIVER", "TEAM", "CIRCUIT", "ERA"]);

export async function POST(req: Request) {
  const limited = rateLimit(req, "ask", 20, 60_000);
  if (limited) return limited;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const messages = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  const question = messages.at(-1);
  if (!question || question.role !== "user") return new Response("A user question is required", { status: 400 });
  const context = body.context && VALID_TYPES.has(body.context.type) ? { type: body.context.type, id: String(body.context.id), title: body.context.title } : null;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      try {
        // Retrieve with the question plus the previous user turn for follow-ups ("and in 1977?").
        const prevUser = messages.filter((m) => m.role === "user").at(-2)?.content ?? "";
        const sources = await buildSources(`${question.content} ${prevUser}`.trim(), context);
        send({ type: "sources", sources: sources.map(({ n, title, url }) => ({ n, title, url })) });

        if (!aiEnabled()) {
          send({ type: "text", text: extractiveAnswer(sources, question.content) });
          send({ type: "done" });
          return; // stream is closed in finally
        }

        const contextLine = context ? `The reader is currently on the archive page for: ${context.title ?? context.id} (${context.type.toLowerCase()}).` : "";
        const apiMessages: Anthropic.Beta.BetaMessageParam[] = messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
        apiMessages.push({
          role: "user",
          content: `${sourcesBlock(sources)}\n\n${contextLine}\n\nQuestion: ${question.content}`,
        });
        const system = body.mode === "newcomer" ? `${ASK_SYSTEM}\n\n${NEWCOMER_ADDENDUM}` : ASK_SYSTEM;

        const gen = streamText({ system, messages: apiMessages, effort: "low", maxTokens: 4000 });
        for (;;) {
          const { value, done } = await gen.next();
          if (done) {
            if (value?.stopReason === "refusal") send({ type: "text", text: "\n\n*The assistant declined to answer this request.*" });
            break;
          }
          send({ type: "text", text: value });
        }
        send({ type: "done" });
      } catch (e) {
        console.error("ask error", e);
        send({ type: "error", message: "The archive assistant is unavailable right now. Please try again." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
