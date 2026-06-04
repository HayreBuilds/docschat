# Contributing to docschat

## Running locally

```bash
npm install
export NVIDIA_API_KEY="nvapi-..."

# Index local docs
ts-node src/cli.ts index ./docs

# Start server
ts-node src/server.ts

# Test a question
ts-node src/cli.ts ask "How does authentication work?"
```

## Improving retrieval

The chunk size (300 words, 50 overlap) in `src/crawler.ts` can be tuned.
Smaller chunks = more precise retrieval but more API calls.
Larger chunks = more context but less precise matching.

## Adding new embedding models

Edit `EMBED_MODEL` in `src/embedder.ts`. Any NVIDIA NIM embedding model works.
