# Eldamo App — Complete User Guide

Welcome to **Eldamo App**, a modern desktop lexicon application and concept search engine for J.R.R. Tolkien's Elvish languages and Mannish tongues.

---

## Table of Contents

1. [Overview & Core Features](#1-overview--core-features)
2. [First-Time Setup & Database Acquisition](#2-first-time-setup--database-acquisition)
   - [Option A: Download Pre-built Database (Recommended)](#option-a-download-pre-built-database-recommended)
   - [Option B: Build Database Locally from XML](#option-b-build-database-locally-from-xml)
3. [Search Modes & Retrieval Strategy](#3-search-modes--retrieval-strategy)
   - [Exact Full-Text Search (FTS5)](#exact-full-text-search-fts5)
   - [Semantic Vector Search (Gemini Embedding 2)](#semantic-vector-search-gemini-embedding-2)
4. [Language Taxonomy & Filtering](#4-language-taxonomy--filtering)
5. [Exploring Word Entries & Etymologies](#5-exploring-word-entries--etymologies)
6. [Settings & Gemini API Key Configuration](#6-settings--gemini-api-key-configuration)
7. [Offline Usage & Fallback Modes](#7-offline-usage--fallback-modes)
8. [Advanced: Custom XML Source & Rebuilding Database](#8-advanced-custom-xml-source--rebuilding-database)

---

## 1. Overview & Core Features

Eldamo App provides access to Paul Strack's **Eldamo dataset** — containing over **35,900 lexical entries, 90,800 source attestations, 18,500 derivation chains, and 6,500 cross-language cognates**.

Key capabilities:
- **Instant Keyword Lookup**: Lightning-fast full-text search across all word forms, English glosses, and notes.
- **Multilingual Concept Search**: Search by intent or meaning using Gemini Embedding 2 vectors (768-dimensional L2-normalized embeddings).
- **Linguistic Precision**: Complete bibliographic citations mapped down to Parma Eldalamberon volumes, Letters, and War of the Jewels page/line references.
- **Privacy & Portability**: Single-file SQLite database with in-process vector similarity search powered by `sqlite-vec`.

---

## 2. First-Time Setup & Database Acquisition

To keep the application download tiny (~10MB), Eldamo App ships without the 150MB database pre-packaged. On first launch, a setup prompt guides you through database setup.

### Option A: Download Pre-built Database (Recommended)

1. Launch **Eldamo App**.
2. Click **Settings & DB** in the top-right header (or respond to the first-launch banner).
3. Click **Download Pre-built DB (768-dim Gemini)**.
4. The app streams `eldamo.db` (~150MB) directly into your local app data folder and initializes the search index automatically.

### Option B: Build Database Locally from XML

If you prefer to generate your database locally from raw XML:

1. Download `eldamo-data.xml` using `make fetch-xml` or obtain it from the upstream [Eldamo repository](https://github.com/pfstrack/eldamo).
2. In **Settings & DB**, click **Rebuild from Local XML**.
3. Select your `eldamo-data.xml` path. The build script parses all 35,900 entries, constructs FTS5 indices, and embeds all documents.

---

## 3. Search Modes & Retrieval Strategy

Eldamo App features two complementary search modes accessible via the search bar toggle.

### Exact Full-Text Search (FTS5)

- **Best for**: Direct word lookups, exact glosses, or specific grammatical terms.
- **Examples**:
  - `elen` → Returns Quenya *elen* ("star").
  - `glær` → Returns Sindarin *glær* ("narrative poem, tale").
  - `king` → Returns Quenya *aran*, Sindarin *aran*, Adûnaic *âru*, Primitive *arani*.
- **Features**: Supports prefix matching (`star*`), wildcard expressions, and exact phrase quotes (`"bright star"`).

### Semantic Vector Search (Gemini Embedding 2)

- **Best for**: Conceptual queries, indirect meanings, or multi-word descriptive searches where exact English glosses might not match directly.
- **Examples**:
  - *"words related to radiance or morning light"* → Retrieves `calë` (light), `glær` (gleam), `galad` (radiance), `anar` (sun).
  - *"terms for ocean waves or sea foam"* → Retrieves `eär` (sea), `gaear` (ocean), `falma` (crest/wave), `Elroth` (star-foam).
- **Engine**: Query-time embeddings generated via Gemini Embedding 2 API at 768-dimensions matched against `sqlite-vec` virtual table using cosine similarity KNN.

---

## 4. Language Taxonomy & Filtering

Eldamo covers **48 distinct language definitions** organized into 4 conceptual eras:

| Era | Primary Languages |
|---|---|
| **Neo Languages** | Neo-Quenya (`nq`), Neo-Sindarin (`ns`), Neo-Primitive Elvish (`np`) |
| **Late Period (1950–1973)** | Quenya (`q`), Sindarin (`s`), Primitive Elvish (`p`), Adûnaic (`ad`), Westron (`wes`), Khuzdul (`kh`), Black Speech (`bs`) |
| **Middle Period (1930–1950)** | Middle Quenya (`mq`), Noldorin (`n`), Ilkorin (`ilk`), Danian (`dan`) |
| **Early Period (1910–1930)** | Early Quenya (`eq`), Gnomish (`g`), Early Noldorin (`en`) |

Use the **All Languages** dropdown selector next to the search bar to filter results strictly to a target tongue.

---

## 5. Exploring Word Entries & Etymologies

Clicking any word card opens the **Word Entry Detail Dialog**:

- **Header Badges**: Displays word form `v`, reliability mark (`†` = archaic, `*` = reconstructed, `!` = neologism), language code, and part of speech (`n`, `vb`, `adj`, `root`).
- **Gloss / Translation**: English translation.
- **Source Attestations**: Citations showing where the form appears in Tolkien's manuscripts (e.g. `[PE17/067.0105] elen — star`).
- **Etymological Derivations**: Traces the word back to its Primitive Elvish root (e.g. Quenya *elen* derived from root `EL`).
- **Cross-Language Cognates**: Displays equivalent forms in sibling tongues (e.g. Quenya *elen* ↔ Sindarin *êl*).
- **Linguistic Notes**: Full notes formatted with internal hyperlinks to related entries.

---

## 6. Settings & Gemini API Key Configuration

To enable live query-time vector search using Google's Gemini Embedding 2 model:

1. Obtain a free or pay-as-you-go API key from [Google AI Studio](https://aistudio.google.com/).
2. In Eldamo App, click **Settings & DB** in the top right.
3. Paste your API key in the **Gemini API Key** field.
4. Click **Save & Close**. Your key is securely stored in your user configuration directory (`~/.config/eldamo-app/gemini.key` on macOS/Linux).

---

## 7. Offline Usage & Fallback Modes

Eldamo App is designed to remain fully functional without internet access:

- **Exact Full-Text Search**: Operates 100% locally on disk. No network calls or API keys required.
- **Offline FastEmbed Vector Search**: If no API key is provided or network is unavailable, the application seamlessly falls back to local FastEmbed (`paraphrase-multilingual-mpnet-base-v2`) in the Rust backend for offline vector search.

---

## 8. Advanced: Custom XML Source & Rebuilding Database

To fetch a new upstream version of `eldamo-data.xml` or build from a specific local XML file:

1. **Fetch upstream dataset**:
   ```bash
   make fetch-xml
   ```
   *Downloads `eldamo-data.xml` to `data/eldamo-data.xml` (configurable via `ELDAMO_XML_URL` or `ELDAMO_XML_PATH`).*

2. **Build database with custom XML location**:
   ```bash
   ELDAMO_XML_PATH="/path/to/custom/eldamo-data.xml" make build-db-fts
   ```

3. **Rebuild full 768-dim Gemini vector database**:
   ```bash
   export GEMINI_API_KEY="your-api-key"
   ELDAMO_XML_PATH="data/eldamo-data.xml" make build-db
   ```
