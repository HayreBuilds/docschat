#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import { crawlSite, walkDocDir } from "./crawler.js";
import { embedTexts } from "./embedder.js";

const VERSION = "1.0.0";
const HELP = `
docschat v${VERSION} — AI search for any documentation site

Usage:
  docschat index <url>          Crawl and index a documentation site
  docschat index <dir>          Index a local documentation directory
  docschat serve                Start the search API server
  docschat ask <question>       Ask a question (requires running server)

Options:
  --api-key <key>    NVIDIA NIM API key (or NVIDIA_API_KEY env var)
  --max-pages <n>    Max pages to crawl (default: 50)
  --output <file>    Index output path (default: .docschat/index.json)
  --port <port>      Server port (default: 4242)
  -h, --help         Show help

Environment:
  NVIDIA_API_KEY     Free at https://build.nvidia.com

Examples:
  docschat index https://docs.example.com
  docschat index ./docs
  docschat serve
  docschat ask "How do I configure authentication?"
`;

const GR = "\x1b[32m", CY = "\x1b[36m", RE = "\x1b[31m", R = "\x1b[0m", B = "\x1b[1m", DIM = "\x1b[2m";
const log = (m: string) => process.stdout.write(`  \x1b[36m→\x1b[0m ${m}\n`);
const ok  = (m: string) => process.stdout.write(`  \x1b[32m✔\x1b[0m ${m}\n`);
const err = (m: string) => process.stdout.write(`  \x1b[31m✖\x1b[0m ${m}\n`);

function parseArgs(argv: string[]) {
  const opts = { command: "", target: "", apiKey: process.env.NVIDIA_API_KEY ?? "", maxPages: 50, output: ".docschat/index.json", port: 4242 };
  const nonFlags: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "-h" || a === "--help") { process.stdout.write(HELP); process.exit(0); }
    if (a === "--api-key" && argv[i+1]) { opts.apiKey = argv[++i]!; continue; }
    if (a === "--max-pages" && argv[i+1]) { opts.maxPages = parseInt(argv[++i]!, 10); continue; }
    if (a === "--output" && argv[i+1]) { opts.output = argv[++i]!; continue; }
    if (a === "--port" && argv[i+1]) { opts.port = parseInt(argv[++i]!, 10); continue; }
    if (!a.startsWith("--")) nonFlags.push(a);
  }
  opts.command = nonFlags[0] ?? "";
  opts.target = nonFlags[1] ?? "";
  return opts;
}

async function cmdIndex(target: string, apiKey: string, maxPages: number, output: string) {
  if (!apiKey) { err("NVIDIA API key required"); process.exit(1); }

  process.stdout.write(`\n  \x1b[1m\x1b[36m◆ docschat indexer\x1b[0m\n\n`);

  const isUrl = target.startsWith("http");
  const isDir = !isUrl && fs.existsSync(target) && fs.statSync(target).isDirectory();

  if (!isUrl && !isDir) { err(`Not a valid URL or directory: ${target}`); process.exit(1); }

  let pages: Awaited<ReturnType<typeof crawlSite>>;

  if (isUrl) {
    log(`Crawling ${target} (max ${maxPages} pages)...`);
    pages = await crawlSite(target, maxPages, (done, total, url) => {
      process.stdout.write(`\r  \x1b[36m→\x1b[0m Crawling ${done}/${total}: ${url.slice(0, 60).padEnd(60)}`);
    });
    process.stdout.write("\r\x1b[K");
    ok(`Crawled ${pages.length} pages`);
  } else {
    log(`Scanning ${target}...`);
    pages = walkDocDir(path.resolve(target));
    ok(`Found ${pages.length} documentation files`);
  }

  const allChunks: Array<{ url: string; title: string; text: string }> = [];
  for (const page of pages) {
    for (const chunk of page.chunks) {
      allChunks.push({ url: page.url, title: page.title, text: chunk });
    }
  }
  ok(`Created ${allChunks.length} chunks`);

  log(`Embedding ${allChunks.length} chunks with NVIDIA NIM...`);
  let lastPct = 0;
  const embeddings = await embedTexts(allChunks.map(c => c.text), apiKey);
  ok(`Embeddings complete`);

  const dir = path.dirname(output);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const index = {
    site: target,
    chunks: allChunks.map((c, i) => ({ ...c, embedding: embeddings[i]! })),
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync(output, JSON.stringify(index), "utf-8");
  ok(`Index saved → ${output} (${(fs.statSync(output).size / 1024 / 1024).toFixed(1)}MB)`);

  process.stdout.write(`\n  Next: run \x1b[1mdocschat serve\x1b[0m to start the search API\n`);
  process.stdout.write(`  Or embed the widget on your docs site.\n\n`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.command) { process.stdout.write(HELP); process.exit(0); }

  if (opts.command === "index") {
    if (!opts.target) { err("Usage: docschat index <url-or-dir>"); process.exit(1); }
    await cmdIndex(opts.target, opts.apiKey, opts.maxPages, opts.output);
  } else if (opts.command === "serve") {
    process.env.PORT = String(opts.port);
    require("./server.js");
  } else if (opts.command === "ask") {
    const question = opts.target;
    if (!question) { err("Usage: docschat ask <question>"); process.exit(1); }
    const resp = await fetch(`http://localhost:${opts.port}/api/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, apiKey: opts.apiKey }),
    });
    if (!resp.ok) { err("Could not reach docschat server. Run `docschat serve` first."); process.exit(1); }
    const data = await resp.json() as { answer: string; sources: Array<{ url: string; title: string }> };
    process.stdout.write(`\n${data.answer}\n`);
    if (data.sources.length > 0) {
      process.stdout.write(`\nSources:\n${data.sources.map(s => `  • ${s.title} — ${s.url}`).join("\n")}\n`);
    }
  } else {
    err(`Unknown command: ${opts.command}`);
    process.stdout.write(HELP);
    process.exit(1);
  }
}

main().catch(e => { err((e as Error).message); process.exit(1); });
