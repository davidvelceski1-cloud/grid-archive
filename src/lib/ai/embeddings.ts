/**
 * Voyage AI embeddings (voyage-3.5, 1024 dims, matching the pgvector column).
 * Optional: without VOYAGE_API_KEY, retrieval uses Postgres full-text search only.
 */
export const EMBEDDING_MODEL = process.env.VOYAGE_MODEL || "voyage-3.5";
export const EMBEDDING_DIMS = 1024;

export function embeddingsEnabled(): boolean {
  return Boolean(process.env.VOYAGE_API_KEY);
}

export async function embed(texts: string[], inputType: "document" | "query"): Promise<number[][]> {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.VOYAGE_API_KEY}` },
    body: JSON.stringify({ input: texts, model: EMBEDDING_MODEL, input_type: inputType, output_dimension: EMBEDDING_DIMS }),
  });
  if (!res.ok) throw new Error(`Voyage embeddings failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data: { embedding: number[]; index: number }[] };
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

export function toVectorLiteral(v: number[]): string {
  return `[${v.map((x) => x.toFixed(6)).join(",")}]`;
}
