# 📚 docschat

[![Build Status](https://img.shields.io/github/actions/workflow/status/HayreBuilds/docschat/ci.yml?branch=main)](https://github.com/HayreBuilds/docschat/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![NVIDIA NIM](https://img.shields.io/badge/NVIDIA-NIM-76B900?logo=nvidia&logoColor=white)](https://build.nvidia.com)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/HayreBuilds/docschat/pulls)

**Drop-in AI search for any documentation site. One script tag. Semantic answers. Instant citations.**

> Stop making your users dig through pages of docs. **docschat** adds a ChatGPT-like experience to your static documentation site in under 60 seconds.

---

## 🚀 Quick Setup

### 1. Index your documentation
```bash
npx docschat crawl https://docs.yourproject.com
```

### 2. Add the widget
Add this script to your HTML `<head>` or before `</body>`:
```html
<script src="https://cdn.jsdelivr.net/gh/HayreBuilds/docschat/widget.js"></script>
```

---

## ✨ Key Features

- **🔍 Semantic Search**: Answers questions based on meaning, not just keywords.
- **📍 Source Citations**: Every answer includes links back to the exact page it used.
- **⚡ Drop-in Widget**: Works with Docusaurus, MkDocs, GitBook, or any static HTML.
- **🧠 Powered by NVIDIA NIM**: Uses high-performance `Nemotron-Ultra` and `nv-embedcode` models.
- **📂 Local Indexing**: Saves your index to `.docschat/index.json` for instant subsequent loads.

---

## 💻 Installation

```bash
npm install -g docschat
```

---

## 🛠️ Usage

### Crawl and Index
```bash
# Index a remote URL
docschat crawl https://react.dev

# Index a local directory of Markdown files
docschat index ./docs
```

### Start Local Search Server
```bash
export NVIDIA_API_KEY="your_key"
docschat serve
```

---

## 🏗️ How It Works: The RAG Pipeline

1. **Crawl**: Scans your documentation site and extracts clean text from HTML/Markdown.
2. **Embed**: Converts text chunks into high-dimensional vectors using `nvidia/nv-embedcode-7b-v1`.
3. **Store**: Saves vectors locally in a lightweight JSON vector store.
4. **Retrieve**: When a user asks a question, it finds the top-K most relevant chunks.
5. **Answer**: `nvidia/nemotron-4-340b-instruct` generates a concise answer with citations.

---

## ⚙️ Configuration

| Option | Default | Description |
|:---|:---|:---|
| `--port <n>` | `3001` | Port for the search API server |
| `--model <id>` | `nemotron-ultra` | The LLM to use for answering |
| `--selector <css>`| `article` | CSS selector for the main content area |
| `--depth <n>` | `3` | Maximum crawl depth for remote URLs |

---

## 🤝 Contributing

We love contributions! See our [Contributing Guide](CONTRIBUTING.md) to get started.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

## 💖 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=HayreBuilds/docschat&type=Date)](https://star-history.com/#HayreBuilds/docschat&Date)
