# docschat

> Drop-in AI search for any documentation site. One `<script>` tag. Semantic search with cited answers. Free forever.

```html
<!-- Add to your docs site -->
<script
  src="https://your-server.com/widget.js"
  data-server="https://your-server.com"
  data-api-key="nvapi-..."
  data-title="My Docs Search">
</script>
```

A floating chat button appears on your docs site. Visitors ask questions in natural language and get AI answers with citations.

---

## Quick Start

**Step 1:** Index your documentation

```bash
npm install -g docschat
export NVIDIA_API_KEY="nvapi-..."

# Index a documentation website
docschat index https://docs.myproject.com

# Or index a local docs directory
docschat index ./docs
```

**Step 2:** Start the search server

```bash
docschat serve
# → http://localhost:4242
```

**Step 3:** Add the widget to your docs site

```html
<script
  src="http://localhost:4242/widget.js"
  data-server="http://localhost:4242"
  data-api-key="nvapi-...">
</script>
```

**Get your free NVIDIA API key:** [build.nvidia.com](https://build.nvidia.com)

## Usage

```bash
# Index a website (crawls up to 50 pages by default)
docschat index https://docs.example.com

# Index more pages
docschat index https://docs.example.com --max-pages 200

# Index a local directory (Markdown, HTML, RST, MDX)
docschat index ./docs

# Custom index location
docschat index ./docs --output ./my-index.json

# Start the server
docschat serve
docschat serve --port 4242

# Ask a question from the command line
docschat ask "How do I configure authentication?"

# Ask via the running server
curl -X POST http://localhost:4242/api/search \
  -H "Content-Type: application/json" \
  -d '{"question": "How does routing work?", "apiKey": "nvapi-..."}'
```

## Architecture

```
Documentation site / local directory
        ↓
  Crawl or walk pages
  (respects same-domain links)
        ↓
  Strip HTML, chunk into 300-word segments
  with 50-word overlap
        ↓
  Embed with nvidia/nv-embedcode-7b-v1
  (free NVIDIA NIM endpoint)
        ↓
  Save to .docschat/index.json
        ↓
  User question → embed query →
  cosine similarity search →
  top-6 most relevant chunks
        ↓
  Chunks + question → Nemotron-Ultra
        ↓
  Answer with citations → widget
```

## Widget Options

```html
<script
  src="..."
  data-server="https://your-server.com"
  data-api-key="nvapi-..."
  data-title="Search Docs"
  data-placeholder="Ask a question...">
</script>
```

| Attribute | Description |
|-----------|-------------|
| `data-server` | URL of your docschat server |
| `data-api-key` | NVIDIA NIM API key |
| `data-title` | Widget panel title |
| `data-placeholder` | Input placeholder text |

## Server API

```
POST /api/search          { question, apiKey } → { answer, sources }
GET  /api/status          Index status and stats
GET  /widget.js           Embeddable widget script
```

## Supported File Types

When indexing local directories: `.md`, `.mdx`, `.txt`, `.rst`, `.html`

When crawling websites: all HTML pages on the same domain

## Powered By (free NVIDIA NIM)

- **`nvidia/nv-embedcode-7b-v1`** — Semantic code and text embeddings
- **`nvidia/nemotron-3-ultra-550b-a55b`** — 550B reasoning model for answers

## License

MIT

## Index Format

The index file (`.docschat/index.json`) is a plain JSON object:

```json
{
  "site": "https://docs.example.com",
  "chunks": [
    { "url": "...", "title": "...", "text": "...", "embedding": [0.012, ...] }
  ],
  "createdAt": "2025-01-14T12:00:00Z"
}
```

You can inspect, merge, or version-control the index file. Large sites may produce files of 50-200MB.
