# Eldamo App — Complete User Guide

Welcome to **Eldamo App**, a modern desktop lexicon application and concept search engine for J.R.R. Tolkien's Elvish languages and Mannish tongues.

---

## Table of Contents

1. [Overview & Core Features](#1-overview--core-features)
2. [Application Shell & Navigation](#2-application-shell--navigation)
3. [First-Time Setup & Database Acquisition](#3-first-time-setup--database-acquisition)
4. [Search Modes & Retrieval Strategy](#4-search-modes--retrieval-strategy)
5. [Language Taxonomy & Filtering](#5-language-taxonomy--filtering)
6. [Exploring Word Entries & Etymologies (Right Rail)](#6-exploring-word-entries--etymologies-right-rail)
7. [Tengwar Transliterator Tool](#7-tengwar-transliterator-tool)
8. [Lexicon Assistant (AI Chat)](#8-lexicon-assistant-ai-chat)
9. [Settings, Appearance & Gemini API Key](#9-settings-appearance--gemini-api-key)
10. [Offline Usage & Fallback Behavior](#10-offline-usage--fallback-behavior)

---

## 1. Overview & Core Features

Eldamo App provides access to Paul Strack's **Eldamo dataset** — containing over **35,900 lexical entries, 90,800 source attestations, 18,500 derivation chains, and 6,500 cross-language cognates**.

Key capabilities:
- **Instant Keyword Lookup**: Lightning-fast full-text search (FTS5) across all word forms, English glosses, and notes.
- **Multilingual Concept Search**: Search by intent or meaning using Gemini Embedding 2 vectors (768-dimensional L2-normalized embeddings).
- **Live Tengwar Rendering**: Automatic Elvish script transliteration on search cards and entry details using Glaemscribe and bundled web fonts (Annatar, Eldamar, Parmaite).
- **Side-by-Side Etymology Panel**: Inspect word forms, derivations, cognates, child words, and citations in a persistent right rail without losing your search context.
- **Lexicon Assistant**: Lexicon-grounded AI chat interface to ask questions about Elvish grammar, etymologies, and word roots.
- **Material 3 Neutral Blue Theme**: Clean light and dark modes with system auto-adaptation.

---

## 2. Application Shell & Navigation

Eldamo App uses an OpenWorker-inspired CSS Grid layout shell:

- **Left Sidebar**:
  - Switch surfaces: **Search**, **Browse A–Z**, **Domains**, **Concordance**, **Tengwar**, **Lexicon Assistant**, and **Settings**.
  - **Recent Entries**: Automatically tracks the last 15 words you inspected.
  - **Pinned Entries**: Pin favorite entries to the sidebar for instant access across sessions.
  - **Collapsible**: Click the sidebar icon or press `⌘B` (or `Ctrl+B`) to collapse the sidebar offscreen for max workspace width.
- **Main Workspace**: Scrollable content area with a slim topbar displaying current surface title.
- **Right Rail**: Slide-out inspector drawer for entry details and etymology relations.

---

## 3. First-Time Setup & Database Acquisition

Eldamo App ships as a lightweight binary (~10MB). On first launch, a setup banner guides you through database setup.

1. Open **Settings** (via sidebar or `⌘,`).
2. Select the **Database** tab.
3. Click **Start Download** to download the pre-built 768-dim database package (`eldamo-db.zip`, ~113MB). The app automatically extracts and initializes the search index.
4. Alternatively, click **Build Local DB** to generate the database directly from an upstream `eldamo-data.xml` file.

---

## 4. Search Modes & Retrieval Strategy

### Exact Full-Text Search (FTS5)
- **Best for**: Direct word lookups, exact glosses, or specific grammatical terms.
- **Examples**:
  - `elen` → Returns Quenya *elen* ("star").
  - `glær` → Returns Sindarin *glær* ("narrative poem, tale").
  - `king` → Returns Quenya *aran*, Sindarin *aran*, Adûnaic *âru*, Primitive *arani*.
- **Features**: Supports prefix matching (`star*`), wildcard expressions, and exact phrase quotes (`"bright star"`).

### Semantic Vector Search (Gemini Embedding 2)
- **Best for**: Conceptual queries, indirect meanings, or multi-word descriptive searches.
- **Examples**:
  - *"words related to radiance or morning light"* → Retrieves `calë` (light), `glær` (gleam), `galad` (radiance), `anar` (sun).
  - *"terms for ocean waves or sea foam"* → Retrieves `eär` (sea), `gaear` (ocean), `falma` (crest/wave), `Elroth` (star-foam).
- **Engine**: Query-time embeddings generated via Gemini Embedding 2 API at 768-dimensions matched against `sqlite-vec` virtual table using cosine similarity KNN.

---

## 5. Language Taxonomy & Filtering

Eldamo covers **48 distinct language definitions** organized into 4 conceptual eras:

| Era | Primary Languages |
|---|---|
| **Neo Languages** | Neo-Quenya (`nq`), Neo-Sindarin (`ns`), Neo-Primitive Elvish (`np`) |
| **Late Period (1950–1973)** | Quenya (`q`), Sindarin (`s`), Primitive Elvish (`p`), Adûnaic (`ad`), Westron (`wes`), Khuzdul (`kh`), Black Speech (`bs`) |
| **Middle Period (1930–1950)** | Middle Quenya (`mq`), Noldorin (`n`), Ilkorin (`ilk`), Danian (`dan`) |
| **Early Period (1910–1930)** | Early Quenya (`eq`), Gnomish (`g`), Early Noldorin (`en`) |

Use the language filter dropdown in Search or Browse modes to restrict results to a specific tongue.

---

## 6. Exploring Word Entries & Etymologies (Right Rail)

Clicking any entry card opens the **Right Rail Inspector**:

- **Headword & Live Tengwar**: Displays word form, reliability mark (`†` = archaic, `*` = reconstructed, `!` = neologism), language badge, and live Glaemscribe Tengwar rendering.
- **Gloss / Translation**: English translation.
- **Etymology & Notes**: Linguistic commentary with clickable cross-references.
- **Etymological Derivations**: Traces parent roots (e.g. Quenya *elen* derived from root `EL`).
- **Cross-Language Cognates**: Displays equivalent forms in sibling tongues (e.g. Quenya *elen* ↔ Sindarin *êl*).
- **Derived Words / Children**: Lists child words descending from this entry.
- **Source Attestations**: Citations showing where the form appears in Tolkien's manuscripts (e.g. `[PE17/067.0105] elen — star`).

---

## 7. Tengwar Transliterator Tool

Select **Tengwar** from the sidebar to open the free-text transliterator:
- **Modes**: Quenya Classical, Sindarin General Use, Sindarin Beleriand, Adûnaic, Westron, Black Speech, and English.
- **Fonts / Charsets**: Tengwar Annatar, Tengwar Eldamar, Tengwar Parmaite, and Tengwar Sindarin (using Glaemunicode PUA encoding).
- **Presets**: One-click sample phrases ("Elen síla...", "A Elbereth...", "Ash nazg...").
- **Copy Output**: One-click copy of the transcribed sequence to clipboard.

---

## 8. Lexicon Assistant (AI Chat)

Select **Lexicon Assistant** from the sidebar to interact with the grounded AI assistant:
- Ask questions like *"What are the different Quenya words for ocean?"* or *"Explain the etymology of Gilthoniel"*.
- The assistant performs a vector search across the Eldamo corpus, grounds the response in authentic dataset entries, and renders clickable citation chips that open directly in the Right Rail.

---

## 9. Settings, Appearance & Gemini API Key

Open **Settings** (via sidebar or `⌘,`):
- **Appearance**: Toggle between **System Auto**, **Light**, and **Dark** themes.
- **Database**: Check database status, download prebuilt packages, or rebuild locally from XML.
- **Gemini API Key**: Enter your Google AI Studio key to enable live semantic vector search and AI responses in Lexicon Assistant. Stored at `~/Library/Application Support/eldamo-app/gemini.key` on macOS or `~/.config/eldamo-app/gemini.key` on Linux.

---

## 10. Offline Usage & Gemini API Key Clarity

Eldamo App is designed to remain 100% functional without an internet connection or API key:

- **Fully Offline Core Features**: Keyword search (FTS5 BM25), A–Z browsing, domain filters, source concordance, Glaemscribe Tengwar transliteration, and right-rail etymology inspection operate completely on-disk.
- **Prebuilt Vector Index**: Downloading `eldamo-db.zip` installs pre-calculated 768-dim embeddings for all 35,900 entries.
- **Optional Gemini API Key**: An API key (from Google AI Studio) is **only** required for:
  1. Live *query-time* embedding generation during semantic vector search (falls back to exact FTS keyword search if unconfigured).
  2. Conversational generative responses in **Lexicon Assistant** (falls back to grounded lexicon entry matches if unconfigured).
  3. Generating fresh vector embeddings when rebuilding a custom database locally from source XML.
