# Eldamo App

Eldamo App is a cross-platform desktop lexicon viewer and multilingual vector search engine for J.R.R. Tolkien's constructed languages, built with Go (Wails v2), Lit Web Components, SQLite (`sqlite-vec`), and Gemini Embedding 2.

Credit: Checklist and structure based on Mark Allen's ["How to Write a Great README for Your Public GitHub Project"](https://www.markcallen.com/how-to-write-a-great-readme-for-your-public-github-project/).

## Table of Contents

- [Features](#features)
- [Architecture & Search Mechanics](#architecture--search-mechanics)
- [Installation](#installation)
- [Usage](#usage)
- [Development Setup](#development-setup)
- [Database Pipeline & Makefile Commands](#database-pipeline--makefile-commands)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Hybrid Search Engine**: Supports both exact Full-Text Search (FTS5) and semantic vector search using Gemini Embedding 2 (768-dim) or FastEmbed (`paraphrase-multilingual-mpnet-base-v2`).
- **35,900+ Word Entries**: Complete coverage of Quenya, Sindarin, Primitive Elvish, Adûnaic, and 44 other Tolkien language varieties.
- **Rich Linguistic Metadata**: Browse source attestations (`PE17`, `Let`, `WJ`), etymological derivations, and cross-language cognates.
- **Relevance Confidence & Similarity Thresholds**: Cosine similarity score badges and interactive filtering controls for vector search results.
- **Lightweight Distribution**: App binary ships without the database; users can download the pre-built 768-dim vector database (~150MB) on first launch or build locally from XML.
- **Offline Capable**: Full-text search and offline FastEmbed vector search work 100% locally without network access or API keys.

## Architecture & Search Mechanics

```
                   ┌──────────────────────────────────────────────┐
                   │ eldamo-data.xml (35,900 words, 30MB)         │
                   └──────────────────────┬───────────────────────┘
                                          │
                               go run ./cmd/builder
                                          │
                                          ▼
                   ┌──────────────────────────────────────────────┐
                   │ dist/eldamo.db (SQLite + FTS5 + sqlite-vec)  │
                   └──────────────────────┬───────────────────────┘
                                          │
                   ┌──────────────────────┴───────────────────────┐
                   │             Wails v2 (Go) Backend            │
                   │  mattn/go-sqlite3 + sqlite-vec CGO bindings  │
                   └──────────────────────┬───────────────────────┘
                                          │ IPC (Go struct bindings)
                   ┌──────────────────────┴───────────────────────┐
                   │           Vite + Lit Web Components          │
                   │  Shoelace / Web Awesome Dark Parchment Theme │
                   └──────────────────────────────────────────────┘
```

The database co-locates structured dictionary records, an FTS5 full-text index, and `sqlite-vec` `vec0` virtual tables inside a single portable SQLite file (`eldamo.db`).

The application backend uses **Wails v2** (specifically v2.13.0) to bind Go methods to TypeScript frontend handlers.

## Installation

Download the latest release for macOS, Linux, or Windows from GitHub Releases.

```bash
# Extract and launch Eldamo App
./Eldamo
```

On first launch, open **Settings & DB** to download the pre-built 768-dim database or point the app to a local `eldamo-data.xml` file to build the database from scratch.

## Usage

### Searching the Lexicon

1. **Exact / FTS Search**: Type English glosses or Elvish word forms (e.g., `star`, `elen`, `calë`, `water`). FTS5 BM25 matches word forms, glosses, and notes instantly.
2. **Semantic Vector Search**: Select **Semantic Vector Search** mode to find entries by conceptual meaning (e.g., querying *"words meaning radiance or morning light"* returns `calë`, `glær`, `galad`, and `anar`).
3. **Similarity Threshold**: Fine-tune minimum match similarity (50% – 85%) to eliminate lower-confidence results.
4. **Filter by Language**: Narrow queries to Quenya (`q`), Sindarin (`s`), Primitive Elvish (`p`), or Adûnaic (`ad`).

### Optional Gemini API Key Setup

To execute live query-time vector search with Gemini Embedding 2:
1. Obtain an API key from Google AI Studio.
2. Open **Settings & DB** in Eldamo App.
3. Enter your API key and click **Save & Close**.

*(Note: Exact FTS5 search and offline FastEmbed vector search require no API key).*

## Development Setup

### Prerequisites

- **Go toolchain** (1.22+): `go version`
- **Wails v2 CLI** (`v2.13.0`): `go install github.com/wailsapp/wails/v2/cmd/wails@latest`
- **Node.js** (v18+ or v20+): `node --version`

### Quickstart with Makefile

```bash
# 1. Clone repository
git clone https://github.com/ghchinoy/eldamo-app.git
cd eldamo-app

# 2. Install frontend dependencies
npm install

# 3. Fetch XML dataset & build FTS database
make build-db-fts

# 4. Verify Go compilation
make check

# 5. Launch application in Wails dev mode
make dev
```

## Database Pipeline & Makefile Commands

The build system includes a `Makefile` supporting custom XML dataset locations via the `ELDAMO_XML_PATH` environment variable.

```bash
# Download XML from upstream repository (defaults to data/eldamo-data.xml)
make fetch-xml

# Build structured + FTS5 database (fast, offline, no API key required)
make build-db-fts

# Build full 768-dim vector database using Gemini Embedding 2
export GEMINI_API_KEY="your-api-key"
make build-db

# Run search quality benchmark suite (MRR, Recall@5, Recall@10)
make eval

# Compile production Wails desktop application bundle
make build-app
```

For embedding model benchmarking details, inspect `spike/SPIKE_REPORT.md` which documents comparative evaluations between Local FastEmbed (`paraphrase-multilingual-mpnet-base-v2`) and Cloud Gemini Embedding 2.

## Contributing

Contributions are welcome! Please follow these guidelines:
1. Check open issues in `bd ready` (`bd` issue tracker) before submitting major changes.
2. Ensure `make check` passes cleanly before submitting PRs.
3. Update unit tests and pipeline scripts as appropriate.

## License

MIT License. See [LICENSE](LICENSE) for full details. Eldamo language data is compiled by Paul Strack under the Eldamo project license.
