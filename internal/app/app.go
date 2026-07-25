package app

import (
	"archive/zip"
	"bytes"
	"context"
	"database/sql"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"eldamo-app/internal/db"

	sqlite_vec "github.com/asg017/sqlite-vec-go-bindings/cgo"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const AppVersion = "0.1.0"

type App struct {
	ctx context.Context
	db  *db.Database
}

type NotificationEvent struct {
	Level     string `json:"level"`     // "info", "warning", "error"
	Message   string `json:"message"`
	Timestamp string `json:"timestamp"`
}

type ProgressEvent struct {
	Stage      string  `json:"stage"`       // "downloading", "parsing", "building_fts", "embedding", "complete", "error"
	StatusText string  `json:"status_text"` // e.g. "Downloading: 45MB / 150MB"
	Percent    float64 `json:"percent"`     // 0.0 - 100.0
	Completed  bool    `json:"completed"`
	Error      string  `json:"error,omitempty"`
}

func (a *App) emitNotification(level, message string) {
	evt := NotificationEvent{
		Level:     level,
		Message:   message,
		Timestamp: time.Now().Format("15:04:05"),
	}
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "app_notification", evt)
	}
}

func NewApp() *App {
	return &App{}
}

func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
	dbPath := db.ResolveDBPath()
	if dbPath != "" {
		fmt.Printf("Loaded Eldamo database from %s\n", dbPath)
		database, err := db.NewDatabase(dbPath)
		if err != nil {
			fmt.Printf("Error initializing database: %v\n", err)
		} else {
			a.db = database
		}
	} else {
		fmt.Println("Warning: Eldamo database not found on startup.")
	}
}

func (a *App) Shutdown(ctx context.Context) {
	if a.db != nil {
		_ = a.db.Close()
	}
}

func (a *App) GetAppVersion() string {
	return AppVersion
}

func (a *App) NotifyOpenAbout() {
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "menu_open_about", nil)
	}
}

func (a *App) NotifyOpenConfig() {
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "menu_open_config", nil)
	}
}

func (a *App) Quit() {
	if a.ctx != nil {
		runtime.Quit(a.ctx)
	}
}

func (a *App) GetDBInfo() (db.DBInfo, error) {
	if a.db != nil {
		return a.db.GetInfo(), nil
	}
	dbPath := db.ResolveDBPath()
	if dbPath != "" {
		if fi, err := os.Stat(dbPath); err == nil {
			return db.DBInfo{
				Exists:    true,
				Path:      dbPath,
				SizeBytes: fi.Size(),
			}, nil
		}
	}
	return db.DBInfo{Exists: false}, nil
}

func (a *App) GetLanguages() ([]db.LanguageMeta, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not loaded")
	}
	return a.db.GetLanguages()
}

func (a *App) GetCategoryTree() ([]db.CategoryGroup, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not loaded")
	}
	return a.db.GetCategoryTree()
}

func (a *App) BrowseByCategory(catID string, page *int, pageSize *int) (db.BrowseResult, error) {
	if a.db == nil {
		return db.BrowseResult{}, fmt.Errorf("database not loaded")
	}
	p := 1
	if page != nil && *page > 0 {
		p = *page
	}
	ps := 50
	if pageSize != nil && *pageSize > 0 {
		ps = *pageSize
	}
	return a.db.BrowseByCategory(catID, p, ps)
}

func (a *App) GetSourcesList() ([]db.SourceMeta, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not loaded")
	}
	return a.db.GetSourcesList()
}

func (a *App) GetConcordance(root string, page *int, pageSize *int) (db.BrowseResult, error) {
	if a.db == nil {
		return db.BrowseResult{}, fmt.Errorf("database not loaded")
	}
	p := 1
	if page != nil && *page > 0 {
		p = *page
	}
	ps := 50
	if pageSize != nil && *pageSize > 0 {
		ps = *pageSize
	}
	return a.db.GetConcordance(root, p, ps)
}

func (a *App) GetAttestationsBySource(source string, page *int, pageSize *int) (db.BrowseResult, error) {
	if a.db == nil {
		return db.BrowseResult{}, fmt.Errorf("database not loaded")
	}
	p := 1
	if page != nil && *page > 0 {
		p = *page
	}
	ps := 50
	if pageSize != nil && *pageSize > 0 {
		ps = *pageSize
	}
	return a.db.GetAttestationsBySource(source, p, ps)
}

func (a *App) SearchFTS(query string, lang *string, speech *string, limit *int) ([]db.SearchResult, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not loaded")
	}
	l := 25
	if limit != nil && *limit > 0 {
		l = *limit
	}
	return a.db.SearchFTS(query, lang, speech, l)
}

func (a *App) SearchVector(queryVector []float32, limit *int) ([]db.SearchResult, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not loaded")
	}
	l := 25
	if limit != nil && *limit > 0 {
		l = *limit
	}
	return a.db.SearchVector(queryVector, l)
}

func (a *App) SearchVectorQuery(query string, limit *int) ([]db.SearchResult, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not loaded")
	}
	l := 25
	if limit != nil && *limit > 0 {
		l = *limit
	}

	apiKey, _ := a.GetAPIKey()
	if apiKey == nil || *apiKey == "" {
		a.emitNotification("warning", "Gemini API Key required for Semantic Vector Search. Showing FTS keyword results.")
		return a.db.SearchFTS(query, nil, nil, l)
	}

	client := &http.Client{Timeout: 15 * time.Second}
	vec, err := generateSingleEmbedding(client, *apiKey, query)
	if err != nil {
		a.emitNotification("warning", fmt.Sprintf("Semantic search API error: %v. Showing FTS keyword results.", err))
		return a.db.SearchFTS(query, nil, nil, l)
	}

	results, err := a.db.SearchVector(vec, l)
	if err != nil || len(results) == 0 {
		a.emitNotification("warning", "No vector index matches found. Showing FTS keyword results.")
		return a.db.SearchFTS(query, nil, nil, l)
	}

	return results, nil
}

type AssistantResponse struct {
	Answer    string         `json:"answer"`
	Citations []db.WordEntry `json:"citations"`
}

func ptr[T any](v T) *T { return &v }

func (a *App) AskAssistant(prompt string) (*AssistantResponse, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not loaded")
	}

	var entries []db.WordEntry
	var citations []db.WordEntry
	searchResults, err := a.SearchVectorQuery(prompt, ptr(5))
	if err != nil || len(searchResults) == 0 {
		searchResults, _ = a.db.SearchFTS(prompt, nil, nil, 5)
	}

	for _, sr := range searchResults {
		entries = append(entries, sr.Entry)
		citations = append(citations, sr.Entry)
	}

	apiKey, _ := a.GetAPIKey()
	if apiKey == nil || *apiKey == "" {
		if len(entries) == 0 {
			return &AssistantResponse{
				Answer: "I couldn't find relevant entries in the Eldamo lexicon for your query. Try searching for a specific Elvish word or English gloss.",
			}, nil
		}

		var sb strings.Builder
		sb.WriteString("Here are the top matching lexicon entries from Eldamo for your query:\n\n")
		for _, e := range entries {
			sb.WriteString(fmt.Sprintf("• **%s** (%s) — *%s*\n  Notes: %s\n\n", e.V, e.L, e.Gloss, e.NotesClean))
		}
		sb.WriteString("\n*(Add a Gemini API Key in Settings for AI-generated responses)*")

		return &AssistantResponse{
			Answer:    sb.String(),
			Citations: citations,
		}, nil
	}

	client := &http.Client{Timeout: 20 * time.Second}
	var contextBuilder strings.Builder
	contextBuilder.WriteString("Grounding entries from Eldamo Lexicon:\n")
	for _, e := range entries {
		contextBuilder.WriteString(fmt.Sprintf("- Word: %s | Lang: %s | Gloss: %s | Notes: %s\n", e.V, e.L, e.Gloss, e.NotesClean))
	}

	payload := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"role": "user",
				"parts": []map[string]string{
					{
						"text": fmt.Sprintf(
							"You are the Eldamo Elvish Lexicon Assistant, an expert in J.R.R. Tolkien's constructed languages (Quenya, Sindarin, Adûnaic, Primitive Elvish, Westron, Khuzdul, etc.).\n\n%s\n\nUser Question: %s\n\nAnswer concisely, accurately, and politely based on Tolkien's linguistic materials.",
							contextBuilder.String(), prompt,
						),
					},
				},
			},
		},
	}

	bodyBytes, _ := json.Marshal(payload)
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=%s", *apiKey)

	resp, err := client.Post(url, "application/json", bytes.NewReader(bodyBytes))
	if err != nil {
		return &AssistantResponse{
			Answer:    fmt.Sprintf("Error calling Gemini API: %v. Showing grounding entries:\n\n%s", err, contextBuilder.String()),
			Citations: citations,
		}, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return &AssistantResponse{
			Answer:    fmt.Sprintf("Gemini API error (HTTP %d): %s", resp.StatusCode, string(respBody)),
			Citations: citations,
		}, nil
	}

	var geminiResp struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&geminiResp); err != nil || len(geminiResp.Candidates) == 0 {
		return &AssistantResponse{
			Answer:    "Failed to parse Gemini response.",
			Citations: citations,
		}, nil
	}

	var ansBuilder strings.Builder
	for _, part := range geminiResp.Candidates[0].Content.Parts {
		ansBuilder.WriteString(part.Text)
	}

	return &AssistantResponse{
		Answer:    ansBuilder.String(),
		Citations: citations,
	}, nil
}

func generateSingleEmbedding(client *http.Client, apiKey string, text string) ([]float32, error) {
	endpoint := "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=" + apiKey
	return fetchEmbeddingWithRetry(client, endpoint, text)
}

func (a *App) BrowseWords(letter *string, lang *string, page *int, pageSize *int) (db.BrowseResult, error) {
	if a.db == nil {
		return db.BrowseResult{}, fmt.Errorf("database not loaded")
	}
	p := 1
	if page != nil && *page > 0 {
		p = *page
	}
	ps := 50
	if pageSize != nil && *pageSize > 0 {
		ps = *pageSize
	}
	return a.db.BrowseAlphabetical(letter, lang, p, ps)
}

func (a *App) GetEntry(pageID int64) (*db.FullEntryDetail, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not loaded")
	}
	return a.db.GetFullEntry(pageID)
}

func (a *App) emitProgress(stage, text string, percent float64, completed bool, err string) {
	evt := ProgressEvent{
		Stage:      stage,
		StatusText: text,
		Percent:    percent,
		Completed:  completed,
		Error:      err,
	}
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "db_progress", evt)
	}
}

type progressWriter struct {
	total      int64
	downloaded int64
	onProgress func(downloaded, total int64)
}

func (pw *progressWriter) Write(p []byte) (int, error) {
	n := len(p)
	pw.downloaded += int64(n)
	pw.onProgress(pw.downloaded, pw.total)
	return n, nil
}

func (a *App) StartDownloadDB(url *string) error {
	go func() {
		targetURL := "https://github.com/ghchinoy/eldamo-app/releases/latest/download/eldamo-db.zip"
		if url != nil && *url != "" {
			targetURL = *url
		}

		a.emitProgress("downloading", "Initiating database download...", 0.0, false, "")

		resp, err := http.Get(targetURL)
		if err != nil {
			a.emitProgress("error", "Download failed", 0.0, false, err.Error())
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			a.emitProgress("error", "Download HTTP error", 0.0, false, fmt.Sprintf("HTTP Status %s", resp.Status))
			return
		}

		contentLength := resp.ContentLength
		if contentLength <= 0 {
			contentLength = 100 * 1024 * 1024
		}

		cwd, err := os.Getwd()
		if err != nil {
			a.emitProgress("error", "Failed to resolve working directory", 0.0, false, err.Error())
			return
		}

		distDir := filepath.Join(cwd, "dist")
		_ = os.MkdirAll(distDir, 0755)
		dbPath := filepath.Join(distDir, "eldamo.db")

		isZip := strings.HasSuffix(strings.ToLower(targetURL), ".zip")
		downloadPath := dbPath + ".tmp"
		if isZip {
			downloadPath = dbPath + ".zip.tmp"
		}

		outFile, err := os.Create(downloadPath)
		if err != nil {
			a.emitProgress("error", "Failed to create temporary file", 0.0, false, err.Error())
			return
		}

		pw := &progressWriter{
			total: contentLength,
			onProgress: func(downloaded, total int64) {
				pct := (float64(downloaded) / float64(total)) * 80.0
				if pct > 80.0 {
					pct = 79.9
				}
				mbDL := float64(downloaded) / (1024 * 1024)
				mbTotal := float64(total) / (1024 * 1024)
				msg := fmt.Sprintf("Downloading database package: %.1f MB / %.1f MB (%.0f%%)", mbDL, mbTotal, pct)
				a.emitProgress("downloading", msg, pct, false, "")
			},
		}

		_, err = io.Copy(outFile, io.TeeReader(resp.Body, pw))
		outFile.Close()

		if err != nil {
			os.Remove(downloadPath)
			a.emitProgress("error", "Download interrupted", 0.0, false, err.Error())
			return
		}

		if isZip {
			a.emitProgress("extracting", "Extracting database from zip package...", 85.0, false, "")
			zr, err := zip.OpenReader(downloadPath)
			if err != nil {
				os.Remove(downloadPath)
				a.emitProgress("error", "Failed to open zip package", 0.0, false, err.Error())
				return
			}

			var targetZipFile *zip.File
			for _, f := range zr.File {
				if strings.HasSuffix(f.Name, ".db") {
					targetZipFile = f
					break
				}
			}

			if targetZipFile == nil {
				zr.Close()
				os.Remove(downloadPath)
				a.emitProgress("error", "No .db file found inside zip package", 0.0, false, "")
				return
			}

			extractedTmp := dbPath + ".tmp"
			extractedFile, err := os.Create(extractedTmp)
			if err != nil {
				zr.Close()
				os.Remove(downloadPath)
				a.emitProgress("error", "Failed to create extracted file", 0.0, false, err.Error())
				return
			}

			rc, err := targetZipFile.Open()
			if err != nil {
				extractedFile.Close()
				zr.Close()
				os.Remove(downloadPath)
				a.emitProgress("error", "Failed to read file from zip package", 0.0, false, err.Error())
				return
			}

			_, err = io.Copy(extractedFile, rc)
			rc.Close()
			extractedFile.Close()
			zr.Close()
			os.Remove(downloadPath)

			if err != nil {
				os.Remove(extractedTmp)
				a.emitProgress("error", "Extraction interrupted", 0.0, false, err.Error())
				return
			}

			downloadPath = extractedTmp
		}

		if a.db != nil {
			_ = a.db.Close()
			a.db = nil
		}

		_ = os.Remove(dbPath)
		if err := os.Rename(downloadPath, dbPath); err != nil {
			a.emitProgress("error", "Failed to finalize database file", 0.0, false, err.Error())
			return
		}

		newDB, err := db.NewDatabase(dbPath)
		if err != nil {
			a.emitProgress("error", "Failed to open downloaded database", 0.0, false, err.Error())
			return
		}
		a.db = newDB

		a.emitProgress("complete", "Database successfully installed and loaded!", 100.0, true, "")
	}()

	return nil
}

func (a *App) StartBuildLocalDB(generateVectors bool) error {
	go func() {
		xmlPath := filepath.Join("data", "eldamo-data.xml")
		dbPath := filepath.Join("dist", "eldamo.db")

		// Step 1: Ensure XML dataset exists
		if _, err := os.Stat(xmlPath); os.IsNotExist(err) {
			a.emitProgress("download_xml", "Downloading canonical eldamo-data.xml...", 5.0, false, "")
			_ = os.MkdirAll("data", 0755)
			xmlURL := "https://raw.githubusercontent.com/pfstrack/eldamo/master/src/data/eldamo-data.xml"
			resp, err := http.Get(xmlURL)
			if err != nil {
				a.emitProgress("error", "Failed to download eldamo-data.xml", 0.0, false, err.Error())
				return
			}
			defer resp.Body.Close()

			outFile, err := os.Create(xmlPath)
			if err != nil {
				a.emitProgress("error", "Failed to save eldamo-data.xml", 0.0, false, err.Error())
				return
			}
			_, _ = io.Copy(outFile, resp.Body)
			outFile.Close()
		}

		// Step 2: Parsing XML
		a.emitProgress("parsing", "Parsing Eldamo XML dataset...", 15.0, false, "")
		xmlData, err := os.ReadFile(xmlPath)
		if err != nil {
			a.emitProgress("error", "Failed to read XML dataset", 0.0, false, err.Error())
			return
		}

		words, langs, cats, refs, derivs, cogs, err := parseXMLEntries(xmlData)
		if err != nil {
			a.emitProgress("error", "Failed to parse XML entries", 0.0, false, err.Error())
			return
		}

		// Step 3: Building SQLite DB & FTS5
		a.emitProgress("building_fts", fmt.Sprintf("Building SQLite FTS5 index for %d entries...", len(words)), 35.0, false, "")

		if a.db != nil {
			_ = a.db.Close()
			a.db = nil
		}
		_ = os.Remove(dbPath)

		sqlite_vec.Auto()
		sqliteDB, err := sql.Open("sqlite3", dbPath)
		if err != nil {
			a.emitProgress("error", "Failed to create SQLite DB", 0.0, false, err.Error())
			return
		}

		schemaSQL := `
		CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
		CREATE TABLE IF NOT EXISTS languages (id TEXT PRIMARY KEY, name TEXT NOT NULL, era TEXT, display_order INTEGER DEFAULT 0);
		CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, group_label TEXT NOT NULL, num TEXT, label TEXT NOT NULL);
		CREATE TABLE IF NOT EXISTS words (
			page_id INTEGER PRIMARY KEY, v TEXT NOT NULL, l TEXT NOT NULL, speech TEXT, gloss TEXT,
			cat TEXT, mark TEXT, stem TEXT, from_v TEXT, tengwar TEXT, orthography TEXT,
			parent_page_id INTEGER, notes_raw TEXT, notes_clean TEXT, search_document TEXT
		);
		CREATE TABLE IF NOT EXISTS word_refs (id INTEGER PRIMARY KEY AUTOINCREMENT, page_id INTEGER NOT NULL, source TEXT NOT NULL, v TEXT, gloss TEXT);
		CREATE TABLE IF NOT EXISTS word_derivations (id INTEGER PRIMARY KEY AUTOINCREMENT, page_id INTEGER NOT NULL, source_v TEXT NOT NULL, source_lang TEXT, ref_source TEXT);
		CREATE TABLE IF NOT EXISTS word_cognates (id INTEGER PRIMARY KEY AUTOINCREMENT, page_id INTEGER NOT NULL, cognate_v TEXT NOT NULL, cognate_lang TEXT, ref_source TEXT);
		CREATE VIRTUAL TABLE IF NOT EXISTS word_fts USING fts5(v, gloss, notes_clean, content='words', content_rowid=page_id);
		CREATE VIRTUAL TABLE IF NOT EXISTS word_vectors USING vec0(page_id INTEGER PRIMARY KEY, embedding float[768]);
		`
		if _, err := sqliteDB.Exec(schemaSQL); err != nil {
			sqliteDB.Close()
			a.emitProgress("error", "Failed to execute DB schema", 0.0, false, err.Error())
			return
		}

		tx, _ := sqliteDB.Begin()
		metaStmt, _ := tx.Prepare("INSERT INTO meta(key, value) VALUES (?, ?)")
		metaStmt.Exec("built_at", time.Now().UTC().Format(time.RFC3339))
		metaStmt.Exec("word_count", strconv.Itoa(len(words)))
		metaStmt.Exec("language_count", strconv.Itoa(len(langs)))
		if generateVectors {
			metaStmt.Exec("embedding_model", "gemini-embedding-2")
			metaStmt.Exec("embedding_dimensions", "768")
		} else {
			metaStmt.Exec("embedding_model", "none")
			metaStmt.Exec("embedding_dimensions", "0")
		}
		metaStmt.Close()

		langStmt, _ := tx.Prepare("INSERT INTO languages(id, name, era, display_order) VALUES (?, ?, ?, ?)")
		for _, l := range langs {
			langStmt.Exec(l.ID, l.Name, l.Era, l.DisplayOrder)
		}
		langStmt.Close()

		catStmt, _ := tx.Prepare("INSERT INTO categories(id, group_id, group_label, num, label) VALUES (?, ?, ?, ?, ?)")
		for _, c := range cats {
			catStmt.Exec(c.ID, c.GroupID, c.GroupLabel, c.Num, c.Label)
		}
		catStmt.Close()

		wordStmt, _ := tx.Prepare(`INSERT INTO words(page_id, v, l, speech, gloss, cat, mark, stem, from_v, tengwar, orthography, parent_page_id, notes_raw, notes_clean, search_document) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
		ftsStmt, _ := tx.Prepare("INSERT INTO word_fts(rowid, v, gloss, notes_clean) VALUES (?, ?, ?, ?)")

		for _, w := range words {
			searchDoc := fmt.Sprintf("title: %s (%s) | text: %s — %s. %s", w.V, w.L, w.Speech, w.Gloss, w.NotesClean)
			wordStmt.Exec(w.PageID, w.V, w.L, w.Speech, w.Gloss, w.Cat, w.Mark, w.Stem, w.FromV, w.Tengwar, w.Orthography, w.ParentPageID, w.NotesRaw, w.NotesClean, searchDoc)
			ftsStmt.Exec(w.PageID, w.V, w.Gloss, w.NotesClean)
		}
		wordStmt.Close()
		ftsStmt.Close()

		refStmt, _ := tx.Prepare("INSERT INTO word_refs(page_id, source, v, gloss) VALUES (?, ?, ?, ?)")
		for _, r := range refs {
			refStmt.Exec(r.PageID, r.Source, r.V, r.Gloss)
		}
		refStmt.Close()

		derivStmt, _ := tx.Prepare("INSERT INTO word_derivations(page_id, source_v, source_lang, ref_source) VALUES (?, ?, ?, ?)")
		for _, d := range derivs {
			derivStmt.Exec(d.PageID, d.SourceV, d.SourceLang, d.RefSource)
		}
		derivStmt.Close()

		cogStmt, _ := tx.Prepare("INSERT INTO word_cognates(page_id, cognate_v, cognate_lang, ref_source) VALUES (?, ?, ?, ?)")
		for _, c := range cogs {
			cogStmt.Exec(c.PageID, c.CognateV, c.CognateLang, c.RefSource)
		}
		cogStmt.Close()

		_ = tx.Commit()

		// Step 4: Vectors if requested
		apiKey, _ := a.GetAPIKey()
		if generateVectors && apiKey != nil && *apiKey != "" {
			a.emitProgress("embedding", "Generating 768-dim Gemini vector embeddings...", 50.0, false, "")
			embeddings, err := generateGeminiEmbeddingsAsync(a, *apiKey, words)
			if err != nil {
				a.emitProgress("error", "Vector generation failed", 0.0, false, err.Error())
			} else {
				vecTx, _ := sqliteDB.Begin()
				vecStmt, _ := vecTx.Prepare("INSERT INTO word_vectors(page_id, embedding) VALUES (?, ?)")
				for pid, emb := range embeddings {
					rawBytes := serializeFloat32(emb)
					vecStmt.Exec(pid, rawBytes)
				}
				vecStmt.Close()
				_ = vecTx.Commit()
			}
		}

		sqliteDB.Exec("ANALYZE")
		sqliteDB.Exec("VACUUM")
		sqliteDB.Close()

		newDB, err := db.NewDatabase(dbPath)
		if err != nil {
			a.emitProgress("error", "Failed to reload built database", 0.0, false, err.Error())
			return
		}
		a.db = newDB

		a.emitProgress("complete", "Database build complete!", 100.0, true, "")
	}()

	return nil
}

type refItem struct {
	PageID int64
	Source string
	V      string
	Gloss  string
}

type derivItem struct {
	PageID     int64
	SourceV    string
	SourceLang string
	RefSource  string
}

type cogItem struct {
	PageID      int64
	CognateV    string
	CognateLang string
	RefSource   string
}

func parseXMLEntries(content []byte) ([]db.WordEntry, []db.LanguageMeta, []db.Category, []refItem, []derivItem, []cogItem, error) {
	text := string(content)
	lines := strings.Split(text, "\n")

	var langs []db.LanguageMeta
	var cats []db.Category
	var words []db.WordEntry
	var refs []refItem
	var derivs []derivItem
	var cogs []cogItem

	var currentEra string
	for _, line := range lines {
		l := strings.TrimSpace(line)
		if strings.HasPrefix(l, "<language-cat") {
			if idx := strings.Index(l, "id=\""); idx != -1 {
				sub := l[idx+4:]
				if end := strings.Index(sub, "\""); end != -1 {
					currentEra = sub[:end]
				}
			}
		} else if strings.HasPrefix(l, "<language ") {
			id := getAttr(l, "id")
			name := getAttr(l, "name")
			ordStr := getAttr(l, "order")
			ord, _ := strconv.Atoi(ordStr)
			if id != "" {
				langs = append(langs, db.LanguageMeta{
					ID:           id,
					Name:         name,
					Era:          currentEra,
					DisplayOrder: ord,
				})
			}
		}
	}

	// Extract <cats> taxonomy
	if catsStart := strings.Index(text, "<cats>"); catsStart != -1 {
		if catsEnd := strings.Index(text[catsStart:], "</cats>"); catsEnd != -1 {
			catsBlock := text[catsStart : catsStart+catsEnd]
			groupBlocks := strings.Split(catsBlock, "<cat-group ")
			for _, gBlock := range groupBlocks[1:] {
				gid := getAttr("<cat-group "+gBlock, "id")
				gLabel := getAttr("<cat-group "+gBlock, "label")
				catLines := strings.Split(gBlock, "<cat ")
				for _, cLine := range catLines[1:] {
					fullCat := "<cat " + cLine
					cid := getAttr(fullCat, "id")
					num := getAttr(fullCat, "num")
					label := getAttr(fullCat, "label")
					if cid != "" && label != "" {
						cats = append(cats, db.Category{
							ID:         cid,
							GroupID:    gid,
							GroupLabel: gLabel,
							Num:        num,
							Label:      label,
						})
					}
				}
			}
		}
	}

	wordBlocks := strings.Split(text, "<word ")
	htmlRegex := regexp.MustCompile(`<[^>]+>`)
	subRefRegex := regexp.MustCompile(`<ref\s+[^>]*source="([^"]+)"[^>]*>`)
	subDerivRegex := regexp.MustCompile(`<deriv\s+[^>]*v="([^"]+)"[^>]*>`)
	subCogRegex := regexp.MustCompile(`<cognate\s+[^>]*v="([^"]+)"[^>]*>`)

	for i, block := range wordBlocks {
		if i == 0 {
			continue
		}
		fullBlock := "<word " + block
		pidStr := getAttr(fullBlock, "page-id")
		v := getAttr(fullBlock, "v")
		l := getAttr(fullBlock, "l")
		if pidStr == "" || v == "" || l == "" {
			continue
		}

		pid, _ := strconv.ParseInt(pidStr, 10, 64)
		speech := getAttr(fullBlock, "speech")
		gloss := getAttr(fullBlock, "gloss")
		cat := getAttr(fullBlock, "cat")
		mark := getAttr(fullBlock, "mark")
		stem := getAttr(fullBlock, "stem")
		fromV := getAttr(fullBlock, "from")
		tengwar := getAttr(fullBlock, "tengwar")
		orthography := getAttr(fullBlock, "orthography")

		notesRaw := ""
		if nStart := strings.Index(fullBlock, "<notes>"); nStart != -1 {
			if nEnd := strings.Index(fullBlock[nStart:], "</notes>"); nEnd != -1 {
				notesRaw = fullBlock[nStart+7 : nStart+nEnd]
			}
		}
		notesClean := strings.Join(strings.Fields(htmlRegex.ReplaceAllString(notesRaw, " ")), " ")

		words = append(words, db.WordEntry{
			PageID:      pid,
			V:           v,
			L:           l,
			Speech:      speech,
			Gloss:       gloss,
			Cat:         cat,
			Mark:        mark,
			Stem:        stem,
			FromV:       fromV,
			Tengwar:     tengwar,
			Orthography: orthography,
			NotesRaw:    notesRaw,
			NotesClean:  notesClean,
		})

		for _, match := range subRefRegex.FindAllStringSubmatch(fullBlock, -1) {
			if len(match) > 1 {
				refs = append(refs, refItem{PageID: pid, Source: match[1], V: v, Gloss: gloss})
			}
		}
		for _, match := range subDerivRegex.FindAllStringSubmatch(fullBlock, -1) {
			if len(match) > 1 {
				derivs = append(derivs, derivItem{PageID: pid, SourceV: match[1]})
			}
		}
		for _, match := range subCogRegex.FindAllStringSubmatch(fullBlock, -1) {
			if len(match) > 1 {
				cogs = append(cogs, cogItem{PageID: pid, CognateV: match[1]})
			}
		}
	}

	return words, langs, cats, refs, derivs, cogs, nil
}

func getAttr(tag, name string) string {
	pattern := name + "=\""
	idx := strings.Index(tag, pattern)
	if idx == -1 {
		return ""
	}
	start := idx + len(pattern)
	end := strings.Index(tag[start:], "\"")
	if end == -1 {
		return ""
	}
	return tag[start : start+end]
}

func fetchEmbeddingWithRetry(client *http.Client, endpoint, text string) ([]float32, error) {
	reqBody := map[string]interface{}{
		"model": "models/gemini-embedding-2",
		"content": map[string]interface{}{
			"parts": []map[string]string{{"text": text}},
		},
		"outputDimensionality": 768,
	}
	bodyBytes, _ := json.Marshal(reqBody)

	backoff := 1 * time.Second
	maxRetries := 5

	for attempt := 1; attempt <= maxRetries; attempt++ {
		resp, err := client.Post(endpoint, "application/json", bytes.NewReader(bodyBytes))
		if err == nil {
			respBytes, _ := io.ReadAll(resp.Body)
			resp.Body.Close()

			if resp.StatusCode == http.StatusOK {
				var geminiResp struct {
					Embedding struct {
						Values []float32 `json:"values"`
					} `json:"embedding"`
				}
				if err := json.Unmarshal(respBytes, &geminiResp); err == nil && len(geminiResp.Embedding.Values) == 768 {
					return geminiResp.Embedding.Values, nil
				}
			}

			if resp.StatusCode == 429 || resp.StatusCode == 503 || resp.StatusCode >= 500 {
				time.Sleep(backoff)
				backoff *= 2
				continue
			}

			return nil, fmt.Errorf("HTTP status %d: %s", resp.StatusCode, string(respBytes))
		}

		time.Sleep(backoff)
		backoff *= 2
	}

	return nil, fmt.Errorf("failed after %d attempts", maxRetries)
}

func generateGeminiEmbeddingsAsync(a *App, apiKey string, words []db.WordEntry) (map[int64][]float32, error) {
	result := make(map[int64][]float32)
	var resultMu sync.Mutex

	endpoint := "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=" + apiKey

	numWorkers := 8
	total := len(words)
	t0 := time.Now()

	type job struct {
		word db.WordEntry
	}
	type res struct {
		pageID int64
		emb    []float32
		err    error
	}

	jobs := make(chan job, total)
	results := make(chan res, total)

	client := &http.Client{Timeout: 30 * time.Second}

	for workerID := 0; workerID < numWorkers; workerID++ {
		go func() {
			for j := range jobs {
				searchDoc := fmt.Sprintf("title: %s (%s) | text: %s — %s. %s", j.word.V, j.word.L, j.word.Speech, j.word.Gloss, j.word.NotesClean)
				emb, err := fetchEmbeddingWithRetry(client, endpoint, searchDoc)
				if err != nil {
					results <- res{pageID: j.word.PageID, err: err}
					continue
				}
				results <- res{pageID: j.word.PageID, emb: emb}
			}
		}()
	}

	for _, w := range words {
		jobs <- job{word: w}
	}
	close(jobs)

	completed := 0
	var firstError error

	for i := 0; i < total; i++ {
		r := <-results
		if r.err != nil {
			if firstError == nil {
				firstError = r.err
			}
		} else {
			resultMu.Lock()
			result[r.pageID] = r.emb
			resultMu.Unlock()
		}

		completed++
		if completed%100 == 0 || completed == total {
			pct := 50.0 + (float64(completed)/float64(total))*48.0
			elapsed := time.Since(t0).Seconds()
			rate := float64(completed) / elapsed
			msg := fmt.Sprintf("Embedding entries: %d / %d (%.1f entry/s)", completed, total, rate)
			a.emitProgress("embedding", msg, pct, false, "")
		}
	}

	if len(result) == 0 && firstError != nil {
		return nil, firstError
	}

	return result, nil
}

func serializeFloat32(vec []float32) []byte {
	buf := make([]byte, len(vec)*4)
	for i, v := range vec {
		u := math.Float32bits(v)
		binary.LittleEndian.PutUint32(buf[i*4:], u)
	}
	return buf
}

func getConfigDir() string {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "."
	}
	return filepath.Join(configDir, "eldamo-app")
}

func (a *App) SetAPIKey(key string) error {
	dir := getConfigDir()
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}
	keyPath := filepath.Join(dir, "gemini.key")
	return os.WriteFile(keyPath, []byte(strings.TrimSpace(key)), 0600)
}

func (a *App) GetAPIKey() (*string, error) {
	keyPath := filepath.Join(getConfigDir(), "gemini.key")
	data, err := os.ReadFile(keyPath)
	if err != nil {
		return nil, nil
	}
	val := strings.TrimSpace(string(data))
	if val == "" {
		return nil, nil
	}
	return &val, nil
}
