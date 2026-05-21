import { VoyageCallError } from "../errors";

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-3";

export interface EmbedResult {
  vector: number[];
  tokens: number;
}

export async function embed(
  text: string,
  inputType: "document" | "query" = "document",
): Promise<EmbedResult> {
  const [first] = await embedBatch([text], inputType);
  if (!first) throw new VoyageCallError("Voyage returned empty data array");
  return first;
}

// Batched embedding — Voyage accepts up to 128 inputs per request (also 120K
// tokens per request). Batching reduces the offline backfill from 415
// requests to 4-5, which keeps us under the free-tier rate limit (3 RPM /
// 10K TPM until a payment method is added).
export async function embedBatch(
  texts: string[],
  inputType: "document" | "query" = "document",
): Promise<EmbedResult[]> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new VoyageCallError("VOYAGE_API_KEY not set");
  if (texts.length === 0) return [];

  const resp = await fetch(VOYAGE_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: texts,
      input_type: inputType,
    }),
  });

  if (!resp.ok) {
    throw new VoyageCallError(
      `Voyage returned ${resp.status}: ${await resp.text()}`,
    );
  }
  const data = (await resp.json()) as {
    data: { embedding: number[]; index?: number }[];
    usage: { total_tokens: number };
  };
  // Voyage returns results in the same order as input; we also guard via
  // .index when present to be safe.
  const sorted = [...data.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const perItemTokens = data.usage.total_tokens / sorted.length;
  return sorted.map((d) => ({ vector: d.embedding, tokens: perItemTokens }));
}
