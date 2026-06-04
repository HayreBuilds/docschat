const NIM_BASE = "https://integrate.api.nvidia.com/v1";
const EMBED_MODEL = "nvidia/nv-embedcode-7b-v1";
const BATCH = 16;

export async function embedTexts(texts: string[], apiKey: string): Promise<number[][]> {
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const resp = await fetch(`${NIM_BASE}/embeddings`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBED_MODEL, input: batch, input_type: "passage", truncate: "END" }),
    });
    if (!resp.ok) throw new Error(`Embedding error ${resp.status}`);
    const data = await resp.json() as { data: Array<{ index: number; embedding: number[] }> };
    results.push(...data.data.sort((a, b) => a.index - b.index).map(d => d.embedding));
    if (i + BATCH < texts.length) await new Promise(r => setTimeout(r, 400));
  }
  return results;
}

export async function embedQuery(text: string, apiKey: string): Promise<number[]> {
  const resp = await fetch(`${NIM_BASE}/embeddings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: text, input_type: "query", truncate: "END" }),
  });
  if (!resp.ok) throw new Error(`Query embedding error ${resp.status}`);
  const data = await resp.json() as { data: Array<{ embedding: number[] }> };
  return data.data[0]?.embedding ?? [];
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i]! * b[i]!; na += a[i]! ** 2; nb += b[i]! ** 2; }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}
