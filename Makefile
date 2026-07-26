# Eldamo App Makefile
# Configurable variables via environment or command-line arguments

ELDAMO_XML_URL  ?= https://raw.githubusercontent.com/pfstrack/eldamo/master/src/data/eldamo-data.xml
ELDAMO_XML_PATH ?= data/eldamo-data.xml
ELDAMO_DB_PATH  ?= dist/eldamo.db
WAILS           ?= $(HOME)/go/bin/wails
GO_TAGS         ?= -tags "sqlite_fts5"

.PHONY: help fetch-xml check-dataset-update bump-version build-db-fts build-db build-db-vertex build-frontend build-app package-db-release check eval dev clean

help:
	@echo "Eldamo App Build System"
	@echo ""
	@echo "Configurable Environment Variables:"
	@echo "  ELDAMO_XML_URL   - URL to download eldamo-data.xml (Default: upstream pfstrack/eldamo master)"
	@echo "  ELDAMO_XML_PATH  - Path to eldamo-data.xml (Default: data/eldamo-data.xml)"
	@echo "  ELDAMO_DB_PATH   - Output SQLite database path (Default: dist/eldamo.db)"
	@echo "  GEMINI_API_KEY   - Google Gemini API key for generating 768-dim embeddings"
	@echo "  VERSION          - Target version for 'make bump-version VERSION=0.x.x'"
	@echo ""
	@echo "Available Targets:"
	@echo "  make bump-version         Bump version string across all project files (VERSION=0.x.x)"
	@echo "  make fetch-xml            Download eldamo-data.xml from ELDAMO_XML_URL to ELDAMO_XML_PATH"
	@echo "  make check-dataset-update Check pfstrack/eldamo master for dataset updates vs active database"
	@echo "  make build-db-fts         Build SQLite database with structured dictionary & FTS5 (Go Engine)"
	@echo "  make build-db             Build SQLite database with Gemini Embedding 2 vectors (Go Engine)"
	@echo "  make package-db-release   Zip dist/eldamo.db into dist/eldamo-db.zip for release upload"
	@echo "  make eval                 Run search quality benchmark against active SQLite database (Go Engine)"
	@echo "  make build-frontend       Build Vite + Lit Web Components bundle"
	@echo "  make build-app            Compile Wails Go desktop binary"
	@echo "  make check                Run type-checking and Go compilation verifications"
	@echo "  make dev                  Launch application in Wails live development mode"
	@echo "  make clean                Clean build artifacts and temporary data"

# 0. Version Bump Tool
bump-version:
	@if [ -z "$(VERSION)" ]; then echo "Usage: make bump-version VERSION=0.x.x"; exit 1; fi
	@go run ./cmd/bumpversion -version $(VERSION)

# 1. Download XML Dataset
fetch-xml:
	@mkdir -p $(dir $(ELDAMO_XML_PATH))
	@echo "Downloading Eldamo XML from $(ELDAMO_XML_URL) -> $(ELDAMO_XML_PATH)..."
	@curl -sSL "$(ELDAMO_XML_URL)" -o "$(ELDAMO_XML_PATH)"
	@echo "✓ Download complete. File size: $$(du -h $(ELDAMO_XML_PATH) | cut -f1)"

# 1b. Check for Dataset Updates
check-dataset-update:
	@ELDAMO_DB_PATH="$(ELDAMO_DB_PATH)" go run $(GO_TAGS) ./cmd/builder -check-update

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

# 6b. Package DB Release Asset
package-db-release:
	@if [ ! -f "$(ELDAMO_DB_PATH)" ]; then echo "Error: $(ELDAMO_DB_PATH) not found. Run make build-db first."; exit 1; fi
	@echo "Packaging $(ELDAMO_DB_PATH) -> dist/eldamo-db.zip..."
	@cd dist && zip -9 eldamo-db.zip eldamo.db
	@echo "✓ Created dist/eldamo-db.zip ($$(du -h dist/eldamo-db.zip | cut -f1))"

# 7. Verification / Checks
check: build-frontend
	@echo "Verifying Go compilation..."
	@go build $(GO_TAGS) -o /dev/null .
	@go build $(GO_TAGS) -o /dev/null ./cmd/builder
	@go build $(GO_TAGS) -o /dev/null ./cmd/eval
	@go build -o /dev/null ./cmd/bumpversion

# 8. Dev Mode
dev:
	@echo "Starting Wails dev server..."
	@$(WAILS) dev -tags "sqlite_fts5"

# 9. Clean Build Artifacts
clean:
	@rm -rf dist frontend/dist build/bin
	@echo "✓ Cleaned build artifacts."
