#!/usr/bin/env node
import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import { embedQuery, cosine } from "./embedder.js";

const NIM_BASE = "https://integrate.api.nvidia.com/v1";
const CHAT_MODEL = "nvidia/nemotron-3-ultra-550b-a55b";

interface IndexChunk { url: string; title: string; text: string; embedding: number[] }
interface DocIndex { site: string; chunks: IndexChunk[]; createdAt: string }

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4242;
const API_KEY = process.env.NVIDIA_API_KEY ?? "";
const INDEX_PATH = process.env.DOCSCHAT_INDEX ?? ".docschat/index.json";

let docIndex: DocIndex | null = null;

function loadIndex() {
  if (!fs.existsSync(INDEX_PATH)) return;
  try { docIndex = JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8")); } catch {}
}

function searchIndex(queryEmbedding: number[], topK = 6): IndexChunk[] {
  if (!docIndex) return [];
  return docIndex.chunks
    .map(c => ({ chunk: c, score: cosine(queryEmbedding, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(r => r.chunk);
}

async function chatWithContext(question: string, chunks: IndexChunk[], apiKey: string): Promise<string> {
  const context = chunks.map(c => `[${c.title}](${c.url}):\n${c.text}`).join("\n\n---\n\n");
  const resp = await fetch(`${NIM_BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: `You are a helpful documentation assistant. Answer questions based on the provided documentation context. Always cite the source page when referencing specific information. If the context doesn't contain the answer, say so clearly.` },
        { role: "user", content: `Context:\n${context}\n\nQuestion: ${question}` },
      ],
      temperature: 0.2, max_tokens: 1000,
    }),
  });
  if (!resp.ok) throw new Error(`Chat API error ${resp.status}`);
  const data = await resp.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message.content ?? "";
}

function json(res: http.ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" });
  res.end(JSON.stringify(data));
}

function parseBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", c => data += c);
    req.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
  });
}

const PUBLIC_DIR = path.join(__dirname, "..", "public");

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url ?? "/", `http://localhost`);
  const p = urlObj.pathname;
  const method = req.method ?? "GET";

  if (method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" });
    res.end(); return;
  }

  if (p === "/api/search" && method === "POST") {
    const body = await parseBody(req);
    const question = body["question"] as string ?? "";
    const apiKey = body["apiKey"] as string ?? API_KEY;
    if (!question) return json(res, 400, { error: "question required" });
    if (!apiKey) return json(res, 400, { error: "apiKey required" });
    if (!docIndex) return json(res, 503, { error: "Index not loaded. Run docschat index first." });
    try {
      const qEmb = await embedQuery(question, apiKey);
      const chunks = searchIndex(qEmb);
      const answer = await chatWithContext(question, chunks, apiKey);
      const sources = [...new Set(chunks.map(c => ({ url: c.url, title: c.title })))];
      return json(res, 200, { answer, sources });
    } catch (e) { return json(res, 500, { error: (e as Error).message }); }
  }

  if (p === "/api/status") {
    return json(res, 200, { loaded: !!docIndex, site: docIndex?.site, chunks: docIndex?.chunks.length ?? 0, created: docIndex?.createdAt });
  }

  if (p === "/widget.js" || p === "/docschat-widget.js") {
    const widgetPath = path.join(PUBLIC_DIR, "widget.js");
    if (fs.existsSync(widgetPath)) {
      res.writeHead(200, { "Content-Type": "text/javascript", "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" });
      fs.createReadStream(widgetPath).pipe(res);
    } else { json(res, 404, { error: "widget not built" }); }
    return;
  }

  if (p === "/" || p === "/index.html") {
    const html = path.join(PUBLIC_DIR, "index.html");
    if (fs.existsSync(html)) { res.writeHead(200, { "Content-Type": "text/html" }); fs.createReadStream(html).pipe(res); }
    else { res.writeHead(200, { "Content-Type": "text/html" }); res.end("<h1>docschat server running</h1><p>Load your index to get started.</p>"); }
    return;
  }

  json(res, 404, { error: "Not found" });
});

loadIndex();
server.listen(PORT, () => {
  process.stdout.write(`\n  ◆ docschat server — http://localhost:${PORT}\n`);
  process.stdout.write(`  Index: ${docIndex ? `${docIndex.chunks.length} chunks from ${docIndex.site}` : "not loaded"}\n\n`);
});
// TODO: POST /api/reindex — re-crawl and re-embed the site without restarting the server
// Implementation: stream progress via SSE, swap index atomically when complete
// TODO: POST /api/reindex — re-crawl and re-embed the site without restarting the server
// Implementation: stream progress via SSE, swap index atomically when complete
