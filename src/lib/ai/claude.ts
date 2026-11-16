/**
 * Server-only Claude client. Keys are read from the environment and never sent
 * to the browser. Every request opts into server-side refusal fallbacks
 * (`fallbacks: "default"`), so a safety-classifier decline is retried on a
 * suitable model instead of failing the user's question.
 * Import only from server code (route handlers, server components, scripts).
 */
import Anthropic from "@anthropic-ai/sdk";

export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

let client: Anthropic | null = null;

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export function claude(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

type Effort = "low" | "medium" | "high";

export interface CompleteOptions {
  system: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  effort?: Effort;
  maxTokens?: number;
}

/** Streaming request; yields text deltas. Used by the chat endpoint. */
export async function* streamText(opts: CompleteOptions): AsyncGenerator<string, { stopReason: string | null }> {
  const stream = claude().beta.messages.stream({
    model: CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 8000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort: opts.effort ?? "low" },
    system: opts.system,
    messages: opts.messages,
  });
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
  }
  const final = await stream.finalMessage();
  return { stopReason: final.stop_reason };
}

/** Structured output: the response is constrained to `schema` and parsed. */
export async function completeJson<T>(opts: CompleteOptions & { schema: Record<string, unknown> }): Promise<T> {
  const msg = await claude().beta.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 2000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort: opts.effort ?? "low", format: { type: "json_schema", schema: opts.schema } },
    system: opts.system,
    messages: opts.messages,
  });
  if (msg.stop_reason === "refusal") throw new Error("The model declined this request.");
  const text = msg.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("");
  return JSON.parse(text) as T;
}

/** Non-streaming convenience used for summaries and batch article generation. */
export async function completeText(opts: CompleteOptions): Promise<string> {
  // Streaming under the hood avoids HTTP timeouts on long outputs.
  const stream = claude().beta.messages.stream({
    model: CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort: opts.effort ?? "medium" },
    system: opts.system,
    messages: opts.messages,
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new Error("The model declined this request.");
  return msg.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}
