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
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new VoyageCallError("VOYAGE_API_KEY not set");

  const resp = await fetch(VOYAGE_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: [text],
      input_type: inputType,
    }),
  });

  if (!resp.ok) {
    throw new VoyageCallError(
      `Voyage returned ${resp.status}: ${await resp.text()}`,
    );
  }
  const data = (await resp.json()) as {
    data: { embedding: number[] }[];
    usage: { total_tokens: number };
  };
  const first = data.data[0];
  if (!first) throw new VoyageCallError("Voyage returned empty data array");
  return {
    vector: first.embedding,
    tokens: data.usage.total_tokens,
  };
}
