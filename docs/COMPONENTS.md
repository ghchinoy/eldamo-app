# Eldamo App — Component Architecture Reference

This document details the Lit Web Component hierarchy, reactive properties, and custom event flows in Eldamo App.

---

## Visual Component Architecture

![Component Hierarchy Diagram](component_hierarchy.webp)

*(Graphviz source available in [`docs/component_hierarchy.dot`](component_hierarchy.dot))*

---

## Lit Web Components Reference

### 1. `<eldamo-app>`
- **Source**: `src/components/eldamo-app.ts`
- **Role**: Root container element and top-level state manager. Coordinates Tauri IPC calls (`invokeApi`) and manages active search/browse results.
- **Key State**:
  - `viewMode`: `"search" | "browse"`
  - `searchResults`: `SearchResult[]`
  - `browseEntries`: `WordEntry[]`
  - `selectedDetail`: `FullEntryDetail | null`
  - `dbMissing`: `boolean`

---

### 2. `<eldamo-header>`
- **Source**: `src/components/header.ts`
- **Role**: Sticky top application bar displaying app title, subtitle, view mode switcher, and settings button.
- **Properties**:
  - `viewMode`: `"search" | "browse"`
- **Events Emitted**:
  - `@mode-change`: `{ detail: { mode: "search" | "browse" } }`
  - `@open-settings`: `{}`

---

### 3. `<eldamo-search-bar>`
- **Source**: `src/components/search-bar.ts`
- **Role**: Search input bar with Shoelace `<sl-input>`, language filter dropdown (`<sl-select>`), and search mode toggle (Exact FTS vs Semantic Vector).
- **Properties**:
  - `query`: `string`
  - `selectedLanguage`: `string`
  - `searchMode`: `"fts" | "vector"`
  - `languages`: `LanguageMeta[]`
- **Events Emitted**:
  - `@search-change`: `{ detail: { query, lang, mode } }`

---

### 4. `<eldamo-browse-bar>`
- **Source**: `src/components/browse-bar.ts`
- **Role**: Alphabetical A–Z letter selector strip, language filter, and paginated navigation controls (`Prev` / `Next`).
- **Properties**:
  - `selectedLetter`: `string` (e.g. `"A"`, `"E"`, or `"ALL"`)
  - `selectedLanguage`: `string`
  - `currentPage`: `number`
  - `totalCount`: `number`
  - `languages`: `LanguageMeta[]`
- **Events Emitted**:
  - `@browse-change`: `{ detail: { letter, lang, page } }`

---

### 5. `<eldamo-result-card>`
- **Source**: `src/components/result-card.ts`
- **Role**: Displays an individual dictionary entry card showing word form `v`, reliability mark, language badge, part of speech, and gloss translation.
- **Properties**:
  - `result`: `{ entry: WordEntry, score: number }`
- **Events Emitted**:
  - `@select-entry`: `{ detail: { page_id: number } }`

---

### 6. `<eldamo-entry-detail-modal>`
- **Source**: `src/components/entry-detail-modal.ts`
- **Role**: Shoelace `<sl-dialog>` modal rendering complete word details, source citations/attestations, etymological derivations, and cross-language cognates.
- **Properties**:
  - `detail`: `FullEntryDetail | null`
  - `open`: `boolean`
- **Events Emitted**:
  - `@modal-closed`: `{}`

---

### 7. `<eldamo-settings-modal>`
- **Source**: `src/components/settings-modal.ts`
- **Role**: Settings and database management dialog providing pre-built database download triggers, local XML rebuild actions, and Gemini API key persistence.
- **Properties**:
  - `open`: `boolean`
  - `dbStatus`: `string`
- **Events Emitted**:
  - `@modal-closed`: `{}`
