# Eldamo App Makefile
# Configurable variables via environment or command-line arguments

ELDAMO_XML_URL  ?= https://raw.githubusercontent.com/pfstrack/eldamo/master/src/data/eldamo-data.xml
ELDAMO_XML_PATH ?= data/eldamo-data.xml
ELDAMO_DB_PATH  ?= dist/eldamo.db
WAILS           ?= $(HOME)/go/bin/wails
GO_TAGS         ?= -tags "sqlite_fts5"

.PHONY: help fetch-xml build-db-fts build-db build-db-vertex build-frontend build-app check eval dev clean

help:
	@echo "Eldamo App Build System"
	@echo ""
	@echo "Configurable Environment Variables:"
	@echo "  ELDAMO_XML_URL   - URL to download eldamo-data.xml (Default: upstream pfstrack/eldamo master)"
	@echo "  ELDAMO_XML_PATH  - Path to eldamo-data.xml (Default: data/eldamo-data.xml)"
	@echo "  ELDAMO_DB_PATH   - Output SQLite database path (Default: dist/eldamo.db)"
	@echo "  GEMINI_API_KEY   - Google Gemini API key for generating 768-dim embeddings"
	@echo ""
	@echo "Available Targets:"
	@echo "  make fetch-xml      Download eldamo-data.xml from ELDAMO_XML_URL to ELDAMO_XML_PATH"
	@echo "  make build-db-fts   Build SQLite database with structured dictionary & FTS5 (Go Engine)"
	@echo "  make build-db       Build SQLite database with Gemini Embedding 2 vectors (Go Engine)"
	@echo "  make eval           Run search quality benchmark against active SQLite database (Go Engine)"
	@echo "  make build-frontend Build Vite + Lit Web Components bundle"
	@echo "  make build-app      Compile Wails Go desktop binary"
	@echo "  make check          Run type-checking and Go compilation verifications"
	@echo "  make dev            Launch application in Wails live development mode"
	@echo "  make clean          Clean build artifacts and temporary data"

# 1. Download XML Dataset
fetch-xml:
	@mkdir -p $(dir $(ELDAMO_XML_PATH))
	@echo "Downloading Eldamo XML from $(ELDAMO_XML_URL) -> $(ELDAMO_XML_PATH)..."
	@curl -sSL "$(ELDAMO_XML_URL)" -o "$(ELDAMO_XML_PATH)"
	@echo "✓ Download complete. File size: $$(du -h $(ELDAMO_XML_PATH) | cut -f1)"

# 2. Build SQLite DB (FTS5 / Structured only)
build-db-fts:
	@if [ ! -f "$(ELDAMO_XML_PATH)" ]; then $(MAKE) fetch-xml; fi
	@echo "Building structured + FTS5 database (Go Engine)..."
	@ELDAMO_XML_PATH="$(ELDAMO_XML_PATH)" ELDAMO_DB_PATH="$(ELDAMO_DB_PATH)" go run $(GO_TAGS) ./cmd/builder

# 3. Build SQLite DB (Full 768-dim Gemini Vector Index)
build-db:
	@if [ ! -f "$(ELDAMO_XML_PATH)" ]; then $(MAKE) fetch-xml; fi
	@echo "Building full vector database with Gemini Embedding 2 (Go Engine)..."
	@ELDAMO_XML_PATH="$(ELDAMO_XML_PATH)" ELDAMO_DB_PATH="$(ELDAMO_DB_PATH)" go run $(GO_TAGS) ./cmd/builder -vectors

# 3b. Build SQLite DB using Google Cloud Vertex AI ADC
build-db-vertex:
	@if [ ! -f "$(ELDAMO_XML_PATH)" ]; then $(MAKE) fetch-xml; fi
	@echo "Building full vector database with Vertex AI text-embedding-004 (ADC)..."
	@ELDAMO_XML_PATH="$(ELDAMO_XML_PATH)" ELDAMO_DB_PATH="$(ELDAMO_DB_PATH)" go run $(GO_TAGS) ./cmd/builder -vectors -vertex

# 4. Evaluate Search Quality
eval:
	@ELDAMO_DB_PATH="$(ELDAMO_DB_PATH)" go run $(GO_TAGS) ./cmd/eval

# 5. Build Frontend
build-frontend:
	@echo "Building frontend Web Components bundle..."
	@npm run build --prefix frontend

# 6. Build App (Wails Go Backend)
build-app: build-frontend
	@echo "Compiling Wails Go application..."
	@$(WAILS) build -tags "sqlite_fts5"

# 7. Verification / Checks
check: build-frontend
	@echo "Verifying Go compilation..."
	@go build $(GO_TAGS) -o /dev/null .
	@go build $(GO_TAGS) -o /dev/null ./cmd/builder
	@go build $(GO_TAGS) -o /dev/null ./cmd/eval

# 8. Dev Mode
dev:
	@echo "Starting Wails dev server..."
	@$(WAILS) dev -tags "sqlite_fts5"

# 9. Clean Build Artifacts
clean:
	@rm -rf dist frontend/dist build/bin
	@echo "✓ Cleaned build artifacts."
