import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";
import * as url from "url";

export interface DocPage {
  url: string;
  title: string;
  content: string;
  chunks: string[];
}

export function chunkText(text: string, size = 300, overlap = 50): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    chunks.push(words.slice(i, i + size).join(" "));
    if (i + size >= words.length) break;
    i += size - overlap;
  }
  return chunks.filter(c => c.length > 40);
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ").replace(/&#\d+;/g, " ").replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m?.[1]?.trim().replace(/\s+/g, " ") ?? "Untitled";
}

function fetchUrl(pageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new url.URL(pageUrl);
    const mod = parsed.protocol === "https:" ? https : http;
    mod.get(pageUrl, { headers: { "User-Agent": "docschat-indexer/1.0" } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location ?? "";
        resolve(fetchUrl(loc.startsWith("http") ? loc : `${parsed.origin}${loc}`));
        return;
      }
      if (!res.statusCode || res.statusCode >= 400) { resolve(""); return; }
      const ct = res.headers["content-type"] ?? "";
      if (!ct.includes("html") && !ct.includes("text")) { resolve(""); return; }
      const chunks: Buffer[] = [];
      res.on("data", c => chunks.push(c as Buffer));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      res.on("error", () => resolve(""));
    }).on("error", () => resolve(""));
  });
}

function extractLinks(html: string, baseUrl: string): string[] {
  const base = new url.URL(baseUrl);
  const links: string[] = [];
  const re = /href=["']([^"'#?]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const link = new url.URL(m[1]!, baseUrl);
      if (link.hostname === base.hostname) links.push(link.href);
    } catch {}
  }
  return [...new Set(links)];
}

export async function crawlSite(
  startUrl: string,
  maxPages = 50,
  onProgress?: (done: number, total: number, url: string) => void
): Promise<DocPage[]> {
  const visited = new Set<string>();
  const queue = [startUrl];
  const pages: DocPage[] = [];

  while (queue.length > 0 && pages.length < maxPages) {
    const pageUrl = queue.shift()!;
    if (visited.has(pageUrl)) continue;
    visited.add(pageUrl);

    if (onProgress) onProgress(pages.length, Math.min(queue.length + pages.length, maxPages), pageUrl);

    const html = await fetchUrl(pageUrl);
    if (!html) continue;

    const title = extractTitle(html);
    const content = stripHtml(html);
    if (content.length < 50) continue;

    const chunks = chunkText(content);
    pages.push({ url: pageUrl, title, content, chunks });

    const links = extractLinks(html, pageUrl);
    for (const link of links) {
      if (!visited.has(link) && !queue.includes(link)) queue.push(link);
    }

    await new Promise(r => setTimeout(r, 200));
  }

  return pages;
}

export function walkDocDir(dir: string): DocPage[] {
  const pages: DocPage[] = [];

  function walk(current: string) {
    for (const e of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      const ext = path.extname(e.name).toLowerCase();
      if (![".md", ".mdx", ".txt", ".rst", ".html"].includes(ext)) continue;
      try {
        const raw = fs.readFileSync(full, "utf-8");
        const content = ext === ".html" ? stripHtml(raw) : raw.replace(/^---[\s\S]*?---\n/m, "").replace(/#{1,6}\s/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/`{1,3}[^`]*`{1,3}/g, "").trim();
        if (content.length < 30) continue;
        const rel = path.relative(dir, full);
        const title = e.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
        const chunks = chunkText(content);
        pages.push({ url: rel, title, content, chunks });
      } catch {}
    }
  }

  walk(dir);
  return pages;
}
