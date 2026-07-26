package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"flag"
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

	sqlite_vec "github.com/asg017/sqlite-vec-go-bindings/cgo"
	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

type Language struct {
	ID    string
	Name  string
	Era   string
	Order int
}

type Word struct {
	PageID         int64
	V              string
	L              string
	Speech         string
	Gloss          string
	Cat            string
	Mark           string
	Stem           string
	FromV          string
	Tengwar        string
	Orthography    string
	ParentPageID   *int64
	NotesRaw       string
	NotesClean     string
	SearchDocument string
}

type Ref struct {
	PageID int64
	Source string
	V      string
	Gloss  string
}

type Derivation struct {
	PageID     int64
	SourceV    string
	SourceLang string
	RefSource  string
}

type Cognate struct {
	PageID      int64
	CognateV    string
	CognateLang string
	RefSource   string
}

type CategoryDef struct {
	ID         string
	GroupID    string
	GroupLabel string
	Num        string
	Label      string
}

type ParsedDataset struct {
	Version     string
	SHA256      string
	Languages   []Language
	Categories  []CategoryDef
	Words       []Word
	Refs        []Ref
	Derivations []Derivation
	Cognates    []Cognate
}

var htmlRegex = regexp.MustCompile(`<[^>]+>`)

func cleanHTML(raw string) string {
	if raw == "" {
		return ""
	}
	clean := htmlRegex.ReplaceAllString(raw, " ")
	fields := strings.Fields(clean)
	return strings.Join(fields, " ")
}

func calculateSHA256(filePath string) (string, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer f.Close()

	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

func parseXML(xmlPath string) (*ParsedDataset, error) {
	data, err := os.ReadFile(xmlPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read xml file: %w", err)
	}

	hashStr, err := calculateSHA256(xmlPath)
	if err != nil {
		return nil, err
	}

	dataset := &ParsedDataset{
		Version: "1.0.0",
		SHA256:  hashStr,
	}

	content := string(data)

	if idx := strings.Index(content, "<word-data"); idx != -1 {
		endIdx := strings.Index(content[idx:], ">")
		if endIdx != -1 {
			tag := content[idx : idx+endIdx]
			if vIdx := strings.Index(tag, "version=\""); vIdx != -1 {
				vStr := tag[vIdx+9:]
				if vEnd := strings.Index(vStr, "\""); vEnd != -1 {
					dataset.Version = vStr[:vEnd]
				}
			}
		}
	} else if idx := strings.Index(content, "<eldamo"); idx != -1 {
		endIdx := strings.Index(content[idx:], ">")
		if endIdx != -1 {
			tag := content[idx : idx+endIdx]
			if vIdx := strings.Index(tag, "version=\""); vIdx != -1 {
				vStr := tag[vIdx+9:]
				if vEnd := strings.Index(vStr, "\""); vEnd != -1 {
					dataset.Version = vStr[:vEnd]
				}
			}
		}
	}

	fmt.Printf("Parsing Eldamo XML v%s from %s...\n", dataset.Version, xmlPath)

	lines := strings.Split(content, "\n")
	var currentLangCat string

	for _, line := range lines {
		lineTrim := strings.TrimSpace(line)
		if strings.HasPrefix(lineTrim, "<language-cat") {
			if idIdx := strings.Index(lineTrim, "id=\""); idIdx != -1 {
				catStr := lineTrim[idIdx+4:]
				if end := strings.Index(catStr, "\""); end != -1 {
					currentLangCat = catStr[:end]
				}
			}
		} else if strings.HasPrefix(lineTrim, "<language ") {
			l := Language{
				Era: currentLangCat,
			}
			if idIdx := strings.Index(lineTrim, "id=\""); idIdx != -1 {
				val := lineTrim[idIdx+4:]
				if end := strings.Index(val, "\""); end != -1 {
					l.ID = val[:end]
				}
			}
			if nameIdx := strings.Index(lineTrim, "name=\""); nameIdx != -1 {
				val := lineTrim[nameIdx+6:]
				if end := strings.Index(val, "\""); end != -1 {
					l.Name = val[:end]
				}
			}
			if ordIdx := strings.Index(lineTrim, "order=\""); ordIdx != -1 {
				val := lineTrim[ordIdx+7:]
				if end := strings.Index(val, "\""); end != -1 {
					l.Order, _ = strconv.Atoi(val[:end])
				}
			}
			if l.ID != "" {
				dataset.Languages = append(dataset.Languages, l)
			}
		}
	}

	fmt.Printf("Extracted %d language definitions.\n", len(dataset.Languages))

	if catsStart := strings.Index(content, "<cats>"); catsStart != -1 {
		if catsEnd := strings.Index(content[catsStart:], "</cats>"); catsEnd != -1 {
			catsBlock := content[catsStart : catsStart+catsEnd]
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
						dataset.Categories = append(dataset.Categories, CategoryDef{
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
	fmt.Printf("Extracted %d taxonomy categories.\n", len(dataset.Categories))

	wordBlocks := strings.Split(content, "<word ")
	var parentStack []int64

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

		pid, err := strconv.ParseInt(pidStr, 10, 64)
		if err != nil {
			continue
		}

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
		notesClean := cleanHTML(notesRaw)

		searchDoc := strings.TrimSpace(fmt.Sprintf("title: %s (%s) | text: %s — %s. %s", v, l, speech, gloss, notesClean))

		var parentID *int64
		if len(parentStack) > 0 {
			parentID = &parentStack[len(parentStack)-1]
		}

		word := Word{
			PageID:         pid,
			V:              v,
			L:              l,
			Speech:         speech,
			Gloss:          gloss,
			Cat:            cat,
			Mark:           mark,
			Stem:           stem,
			FromV:          fromV,
			Tengwar:        tengwar,
			Orthography:    orthography,
			ParentPageID:   parentID,
			NotesRaw:       notesRaw,
			NotesClean:     notesClean,
			SearchDocument: searchDoc,
		}
		dataset.Words = append(dataset.Words, word)

		subRefRegex := regexp.MustCompile(`<ref\s+[^>]*source="([^"]+)"[^>]*>`)
		for _, match := range subRefRegex.FindAllStringSubmatch(fullBlock, -1) {
			if len(match) > 1 {
				dataset.Refs = append(dataset.Refs, Ref{
					PageID: pid,
					Source: match[1],
					V:      v,
					Gloss:  gloss,
				})
			}
		}

		subDerivRegex := regexp.MustCompile(`<deriv\s+[^>]*v="([^"]+)"[^>]*>`)
		for _, match := range subDerivRegex.FindAllStringSubmatch(fullBlock, -1) {
			if len(match) > 1 {
				dataset.Derivations = append(dataset.Derivations, Derivation{
					PageID:  pid,
					SourceV: match[1],
				})
			}
		}

		subCogRegex := regexp.MustCompile(`<cognate\s+[^>]*v="([^"]+)"[^>]*>`)
		for _, match := range subCogRegex.FindAllStringSubmatch(fullBlock, -1) {
			if len(match) > 1 {
				dataset.Cognates = append(dataset.Cognates, Cognate{
					PageID:   pid,
					CognateV: match[1],
				})
			}
		}
	}

	fmt.Printf("Extracted %d words, %d attestations, %d derivations, %d cognates.\n",
		len(dataset.Words), len(dataset.Refs), len(dataset.Derivations), len(dataset.Cognates))

	return dataset, nil
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

func generateEmbeddingsGemini(apiKey string, words []Word, cachePath string, numWorkers int) (map[int64][]float32, error) {
	cache := make(map[string][]float32)
	var cacheMu sync.RWMutex

	if data, err := os.ReadFile(cachePath); err == nil {
		_ = json.Unmarshal(data, &cache)
	}

	fmt.Printf("\nGenerating Gemini Embedding 2 (768-dim) across %d concurrent workers for %d entries...\n", numWorkers, len(words))

	endpoint := "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=" + apiKey
	result := make(map[int64][]float32)
	var resultMu sync.Mutex

	type job struct {
		word Word
	}
	type res struct {
		pageID int64
		emb    []float32
		cached bool
		err    error
	}

	jobs := make(chan job, len(words))
	results := make(chan res, len(words))

	client := &http.Client{Timeout: 30 * time.Second}

	for workerID := 0; workerID < numWorkers; workerID++ {
		go func() {
			for j := range jobs {
				cacheMu.RLock()
				emb, cached := cache[j.word.SearchDocument]
				cacheMu.RUnlock()

				if cached {
					results <- res{pageID: j.word.PageID, emb: emb, cached: true}
					continue
				}

				emb, err := fetchEmbeddingWithRetry(client, endpoint, j.word.SearchDocument)
				if err != nil {
					results <- res{pageID: j.word.PageID, err: err}
					continue
				}

				cacheMu.Lock()
				cache[j.word.SearchDocument] = emb
				cacheMu.Unlock()

				results <- res{pageID: j.word.PageID, emb: emb, cached: false}
			}
		}()
	}

	for _, w := range words {
		jobs <- job{word: w}
	}
	close(jobs)

	hits := 0
	completed := 0
	total := len(words)
	t0 := time.Now()

	var firstError error

	for i := 0; i < total; i++ {
		r := <-results
		if r.err != nil {
			if firstError == nil {
				firstError = r.err
			}
		} else {
			if r.cached {
				hits++
			}
			resultMu.Lock()
			result[r.pageID] = r.emb
			resultMu.Unlock()
		}

		completed++
		if completed%200 == 0 || completed == total {
			cacheMu.RLock()
			_ = os.MkdirAll(filepath.Dir(cachePath), 0755)
			if cacheData, err := json.Marshal(cache); err == nil {
				_ = os.WriteFile(cachePath, cacheData, 0644)
			}
			cacheMu.RUnlock()

			elapsed := time.Since(t0).Seconds()
			rate := float64(completed) / elapsed
			fmt.Printf("  Progress: %d/%d (%d from cache) — %.1f entry/s\n", completed, total, hits, rate)
		}
	}

	if len(result) == 0 && firstError != nil {
		return nil, firstError
	}

	fmt.Printf("Successfully compiled %d/%d vector embeddings.\n", len(result), total)
	return result, nil
}

func fetchVertexEmbeddingWithRetry(client *http.Client, endpoint, text string) ([]float32, error) {
	reqBody := map[string]interface{}{
		"instances": []map[string]string{
			{"content": text},
		},
		"parameters": map[string]interface{}{
			"outputDimensionality": 768,
		},
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
				var vertexResp struct {
					Predictions []struct {
						Embeddings struct {
							Values []float32 `json:"values"`
						} `json:"embeddings"`
					} `json:"predictions"`
				}
				if err := json.Unmarshal(respBytes, &vertexResp); err == nil && len(vertexResp.Predictions) > 0 && len(vertexResp.Predictions[0].Embeddings.Values) == 768 {
					return vertexResp.Predictions[0].Embeddings.Values, nil
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

func generateEmbeddingsVertex(project, location string, words []Word, cachePath string, numWorkers int) (map[int64][]float32, error) {
	ctx := context.Background()
	creds, err := google.FindDefaultCredentials(ctx, "https://www.googleapis.com/auth/cloud-platform")
	if err != nil {
		return nil, fmt.Errorf("failed to find Application Default Credentials (ADC): %w. Run 'gcloud auth application-default login' first", err)
	}

	if project == "" {
		if envProject := os.Getenv("GOOGLE_CLOUD_PROJECT"); envProject != "" {
			project = envProject
		} else if creds.ProjectID != "" {
			project = creds.ProjectID
		}
	}
	if project == "" {
		return nil, fmt.Errorf("Google Cloud project ID not found. Specify via -vertex-project or GOOGLE_CLOUD_PROJECT env var")
	}

	client := oauth2.NewClient(ctx, creds.TokenSource)
	client.Timeout = 30 * time.Second

	endpoint := fmt.Sprintf("https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/google/models/text-embedding-004:predict", location, project, location)

	cache := make(map[string][]float32)
	var cacheMu sync.RWMutex

	if data, err := os.ReadFile(cachePath); err == nil {
		_ = json.Unmarshal(data, &cache)
	}

	fmt.Printf("\nGenerating Vertex AI Embeddings (text-embedding-004, 768-dim, project=%s) across %d workers...\n", project, numWorkers)

	result := make(map[int64][]float32)
	var resultMu sync.Mutex

	type job struct {
		word Word
	}
	type res struct {
		pageID int64
		emb    []float32
		cached bool
		err    error
	}

	jobs := make(chan job, len(words))
	results := make(chan res, len(words))

	for workerID := 0; workerID < numWorkers; workerID++ {
		go func() {
			for j := range jobs {
				cacheMu.RLock()
				emb, cached := cache[j.word.SearchDocument]
				cacheMu.RUnlock()

				if cached {
					results <- res{pageID: j.word.PageID, emb: emb, cached: true}
					continue
				}

				emb, err := fetchVertexEmbeddingWithRetry(client, endpoint, j.word.SearchDocument)
				if err != nil {
					results <- res{pageID: j.word.PageID, err: err}
					continue
				}

				cacheMu.Lock()
				cache[j.word.SearchDocument] = emb
				cacheMu.Unlock()

				results <- res{pageID: j.word.PageID, emb: emb, cached: false}
			}
		}()
	}

	for _, w := range words {
		jobs <- job{word: w}
	}
	close(jobs)

	hits := 0
	completed := 0
	total := len(words)
	t0 := time.Now()

	var firstError error

	for i := 0; i < total; i++ {
		r := <-results
		if r.err != nil {
			if firstError == nil {
				firstError = r.err
			}
		} else {
			if r.cached {
				hits++
			}
			resultMu.Lock()
			result[r.pageID] = r.emb
			resultMu.Unlock()
		}

		completed++
		if completed%200 == 0 || completed == total {
			cacheMu.RLock()
			_ = os.MkdirAll(filepath.Dir(cachePath), 0755)
			if cacheData, err := json.Marshal(cache); err == nil {
				_ = os.WriteFile(cachePath, cacheData, 0644)
			}
			cacheMu.RUnlock()

			elapsed := time.Since(t0).Seconds()
			rate := float64(completed) / elapsed
			fmt.Printf("  Progress: %d/%d (%d from cache) — %.1f entry/s\n", completed, total, hits, rate)
		}
	}

	if len(result) == 0 && firstError != nil {
		return nil, firstError
	}

	fmt.Printf("Successfully compiled %d/%d vector embeddings via Vertex AI.\n", len(result), total)
	return result, nil
}

func checkDatasetUpdate(dbPath string) {
	fmt.Println("=== Eldamo Dataset Update Check ===")
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		fmt.Printf("Active database not found at %s. Run 'make build-db-fts' or 'make build-db' to generate.\n", dbPath)
		return
	}

	sqlite_vec.Auto()
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		fmt.Printf("Error opening active database %s: %v\n", dbPath, err)
		return
	}
	defer db.Close()

	var dbVersion, dbSHA, builtAt string
	_ = db.QueryRow("SELECT value FROM meta WHERE key = 'dataset_version'").Scan(&dbVersion)
	_ = db.QueryRow("SELECT value FROM meta WHERE key = 'dataset_sha256'").Scan(&dbSHA)
	_ = db.QueryRow("SELECT value FROM meta WHERE key = 'built_at'").Scan(&builtAt)

	fmt.Printf("Active Database (%s):\n", dbPath)
	fmt.Printf("  • Shipped Version:  v%s (built %s)\n", dbVersion, builtAt)
	if len(dbSHA) >= 16 {
		fmt.Printf("  • Shipped SHA256:   %s...\n", dbSHA[:16])
	} else {
		fmt.Printf("  • Shipped SHA256:   %s\n", dbSHA)
	}

	upstreamURL := "https://raw.githubusercontent.com/pfstrack/eldamo/master/src/data/eldamo-data.xml"
	fmt.Printf("\nFetching upstream dataset header from %s...\n", upstreamURL)

	resp, err := http.Get(upstreamURL)
	if err != nil {
		fmt.Printf("Error fetching upstream dataset: %v\n", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		fmt.Printf("HTTP Error fetching upstream dataset: %s\n", resp.Status)
		return
	}

	upstreamData, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("Error reading upstream dataset: %v\n", err)
		return
	}

	h := sha256.New()
	h.Write(upstreamData)
	upstreamSHA := hex.EncodeToString(h.Sum(nil))

	upstreamVersion := "unknown"
	content := string(upstreamData)
	if idx := strings.Index(content, "<word-data"); idx != -1 {
		endIdx := strings.Index(content[idx:], ">")
		if endIdx != -1 {
			tag := content[idx : idx+endIdx]
			if vIdx := strings.Index(tag, "version=\""); vIdx != -1 {
				vStr := tag[vIdx+9:]
				if vEnd := strings.Index(vStr, "\""); vEnd != -1 {
					upstreamVersion = vStr[:vEnd]
				}
			}
		}
	}

	fmt.Printf("Upstream Master (pfstrack/eldamo):\n")
	fmt.Printf("  • Upstream Version: v%s\n", upstreamVersion)
	if len(upstreamSHA) >= 16 {
		fmt.Printf("  • Upstream SHA256:  %s...\n", upstreamSHA[:16])
	} else {
		fmt.Printf("  • Upstream SHA256:  %s\n", upstreamSHA)
	}

	fmt.Println("\nResult:")
	if upstreamSHA == dbSHA {
		fmt.Println("✓ Active database is 100% UP-TO-DATE with upstream master.")
	} else {
		fmt.Printf("⚡ UPDATE AVAILABLE! Upstream dataset has changed (v%s vs v%s).\n", upstreamVersion, dbVersion)
		fmt.Println("  Run 'make fetch-xml && make build-db' (or 'make build-db-fts') to rebuild.")
	}
}

func main() {
	xmlPathFlag := flag.String("xml", "data/eldamo-data.xml", "Path to input eldamo-data.xml")
	dbPathFlag := flag.String("db", "dist/eldamo.db", "Path to output eldamo.db")
	vectorFlag := flag.Bool("vectors", false, "Generate vector embeddings using Gemini or Vertex AI")
	vertexFlag := flag.Bool("vertex", false, "Use Google Cloud Vertex AI with Application Default Credentials (ADC) instead of GEMINI_API_KEY")
	vertexProjectFlag := flag.String("vertex-project", "", "Google Cloud project ID for Vertex AI")
	vertexLocationFlag := flag.String("vertex-location", "us-central1", "Google Cloud location for Vertex AI")
	cachePathFlag := flag.String("cache", "spike/data/gemini_cache.json", "Cache file path")
	checkUpdateFlag := flag.Bool("check-update", false, "Check upstream pfstrack/eldamo master dataset for updates against active SQLite database")
	workersFlag := flag.Int("workers", 8, "Number of concurrent embedding workers")
	flag.Parse()

	dbPath := *dbPathFlag
	if envDb := os.Getenv("ELDAMO_DB_PATH"); envDb != "" {
		dbPath = envDb
	}

	if *checkUpdateFlag {
		checkDatasetUpdate(dbPath)
		return
	}

	xmlPath := *xmlPathFlag
	if envXml := os.Getenv("ELDAMO_XML_PATH"); envXml != "" {
		xmlPath = envXml
	}

	apiKey := os.Getenv("GEMINI_API_KEY")
	generateVectors := *vectorFlag

	// Build into atomic temp database path first
	tmpDBPath := dbPath + ".building"
	_ = os.MkdirAll(filepath.Dir(dbPath), 0755)
	_ = os.Remove(tmpDBPath)

	fmt.Printf("\n==========================================\n")
	fmt.Printf("Building Eldamo SQLite Database: %s\n", dbPath)
	fmt.Printf("==========================================\n")

	parsed, err := parseXML(xmlPath)
	if err != nil {
		fmt.Printf("Error parsing XML: %v\n", err)
		os.Exit(1)
	}

	sqlite_vec.Auto()

	db, err := sql.Open("sqlite3", tmpDBPath)
	if err != nil {
		fmt.Printf("Failed to open SQLite database: %v\n", err)
		os.Exit(1)
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

	if _, err := db.Exec(schemaSQL); err != nil {
		db.Close()
		os.Remove(tmpDBPath)
		fmt.Printf("Error executing schema: %v\n", err)
		os.Exit(1)
	}

	tx, err := db.Begin()
	if err != nil {
		db.Close()
		os.Remove(tmpDBPath)
		fmt.Printf("Failed to start transaction: %v\n", err)
		os.Exit(1)
	}

	// Insert meta placeholder
	builtAt := time.Now().UTC().Format(time.RFC3339)
	metaStmt, _ := tx.Prepare("INSERT INTO meta(key, value) VALUES (?, ?)")
	metaStmt.Exec("dataset_version", parsed.Version)
	metaStmt.Exec("dataset_sha256", parsed.SHA256)
	metaStmt.Exec("built_at", builtAt)
	metaStmt.Exec("word_count", strconv.Itoa(len(parsed.Words)))
	metaStmt.Exec("language_count", strconv.Itoa(len(parsed.Languages)))
	metaStmt.Close()

	// Insert languages
	langStmt, _ := tx.Prepare("INSERT INTO languages(id, name, era, display_order) VALUES (?, ?, ?, ?)")
	for _, l := range parsed.Languages {
		langStmt.Exec(l.ID, l.Name, l.Era, l.Order)
	}
	langStmt.Close()

	// Insert categories
	catStmt, _ := tx.Prepare("INSERT INTO categories(id, group_id, group_label, num, label) VALUES (?, ?, ?, ?, ?)")
	for _, c := range parsed.Categories {
		catStmt.Exec(c.ID, c.GroupID, c.GroupLabel, c.Num, c.Label)
	}
	catStmt.Close()

	// Insert words
	wordStmt, _ := tx.Prepare(`INSERT INTO words(
		page_id, v, l, speech, gloss, cat, mark, stem, from_v, tengwar,
		orthography, parent_page_id, notes_raw, notes_clean, search_document
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)

	ftsStmt, _ := tx.Prepare("INSERT INTO word_fts(rowid, v, gloss, notes_clean) VALUES (?, ?, ?, ?)")

	for _, w := range parsed.Words {
		wordStmt.Exec(w.PageID, w.V, w.L, w.Speech, w.Gloss, w.Cat, w.Mark, w.Stem, w.FromV, w.Tengwar, w.Orthography, w.ParentPageID, w.NotesRaw, w.NotesClean, w.SearchDocument)
		ftsStmt.Exec(w.PageID, w.V, w.Gloss, w.NotesClean)
	}
	wordStmt.Close()
	ftsStmt.Close()

	// Insert refs
	refStmt, _ := tx.Prepare("INSERT INTO word_refs(page_id, source, v, gloss) VALUES (?, ?, ?, ?)")
	for _, r := range parsed.Refs {
		refStmt.Exec(r.PageID, r.Source, r.V, r.Gloss)
	}
	refStmt.Close()

	// Insert derivations
	derivStmt, _ := tx.Prepare("INSERT INTO word_derivations(page_id, source_v, source_lang, ref_source) VALUES (?, ?, ?, ?)")
	for _, d := range parsed.Derivations {
		derivStmt.Exec(d.PageID, d.SourceV, d.SourceLang, d.RefSource)
	}
	derivStmt.Close()

	// Insert cognates
	cogStmt, _ := tx.Prepare("INSERT INTO word_cognates(page_id, cognate_v, cognate_lang, ref_source) VALUES (?, ?, ?, ?)")
	for _, c := range parsed.Cognates {
		cogStmt.Exec(c.PageID, c.CognateV, c.CognateLang, c.RefSource)
	}
	cogStmt.Close()

	if err := tx.Commit(); err != nil {
		db.Close()
		os.Remove(tmpDBPath)
		fmt.Printf("Failed to commit dataset transaction: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("Structured dictionary data inserted successfully.")

	vecInserted := 0
	if generateVectors {
		var embeddings map[int64][]float32
		var err error

		if *vertexFlag {
			embeddings, err = generateEmbeddingsVertex(*vertexProjectFlag, *vertexLocationFlag, parsed.Words, *cachePathFlag, *workersFlag)
		} else if apiKey != "" {
			embeddings, err = generateEmbeddingsGemini(apiKey, parsed.Words, *cachePathFlag, *workersFlag)
		} else {
			fmt.Println("Warning: Neither -vertex flag nor GEMINI_API_KEY set. Skipping vector embedding generation.")
		}

		if err != nil {
			fmt.Printf("Warning: embedding worker reported errors: %v\n", err)
		}
		if len(embeddings) > 0 {
			fmt.Printf("Inserting %d vector embeddings into word_vectors table...\n", len(embeddings))
			vecTx, _ := db.Begin()
			vecStmt, _ := vecTx.Prepare("INSERT INTO word_vectors(page_id, embedding) VALUES (?, ?)")

			for pid, emb := range embeddings {
				rawBytes := serializeFloat32(emb)
				vecStmt.Exec(pid, rawBytes)
				vecInserted++
			}
			vecStmt.Close()
			vecTx.Commit()
			fmt.Println("Vector embeddings inserted successfully.")
		}
	}

	// Update meta with actual embedding status and coverage
	if vecInserted > 0 {
		db.Exec("INSERT OR REPLACE INTO meta(key, value) VALUES ('embedding_model', 'gemini-embedding-2')")
		db.Exec("INSERT OR REPLACE INTO meta(key, value) VALUES ('embedding_dimensions', '768')")
		coveragePct := (float64(vecInserted) / float64(len(parsed.Words))) * 100.0
		db.Exec(fmt.Sprintf("INSERT OR REPLACE INTO meta(key, value) VALUES ('vector_coverage', '%.1f%%')", coveragePct))
	} else {
		db.Exec("INSERT OR REPLACE INTO meta(key, value) VALUES ('embedding_model', 'none')")
		db.Exec("INSERT OR REPLACE INTO meta(key, value) VALUES ('embedding_dimensions', '0')")
		db.Exec("INSERT OR REPLACE INTO meta(key, value) VALUES ('vector_coverage', '0%')")
	}

	fmt.Println("Optimizing SQLite database...")
	db.Exec("ANALYZE")
	db.Exec("VACUUM")
	db.Close()

	// Atomic replacement with .bak rollback protection
	bakPath := dbPath + ".bak"
	if _, err := os.Stat(dbPath); err == nil {
		_ = os.Remove(bakPath)
		_ = os.Rename(dbPath, bakPath)
	}

	if err := os.Rename(tmpDBPath, dbPath); err != nil {
		fmt.Printf("Error replacing database file: %v\n", err)
		if _, err := os.Stat(bakPath); err == nil {
			_ = os.Rename(bakPath, dbPath)
		}
		os.Exit(1)
	}

	if fi, err := os.Stat(dbPath); err == nil {
		fmt.Printf("\n✓ Database build complete! Final file size: %.2f MB at %s\n", float64(fi.Size())/(1024*1024), dbPath)
	}
}

func serializeFloat32(vec []float32) []byte {
	buf := make([]byte, len(vec)*4)
	for i, v := range vec {
		u := math.Float32bits(v)
		binary.LittleEndian.PutUint32(buf[i*4:], u)
	}
	return buf
}
