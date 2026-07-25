# Core Architecture

Eldamo Desktop App is a Wails v2 (Go + Lit Web Components) desktop dictionary and semantic search engine for J.R.R. Tolkien's constructed languages.

## Key Subsystems
- **Backend (Go)**: `main.go`, `internal/app/app.go` (Wails App bindings & IPC), `internal/db/` (SQLite + sqlite-vec vector search & FTS5).
- **Frontend (Lit)**: `frontend/src/components/` (Web Components), `frontend/src/services/` (Glaemscribe transliteration wrapper), `frontend/src/styles/` (Theme & Tengwar CSS).
- **Embedded Web Fonts & Glaemscribe Assets**: `frontend/public/fonts/` (Tengwar Annatar/Eldamar/Parmaite), `frontend/public/glaemscribe/` (core engine, modes, Glaemunicode charsets).

## Invariants
- Version string source of truth is `internal/app/app.go` (`AppVersion = "1.0.0"`), retrieved via `invokeApi("get_app_version")`.
- Native macOS menu is configured in `main.go`, dispatching Wails runtime events (`menu_open_about`, `menu_open_config`) to open in-app Lit modals.
