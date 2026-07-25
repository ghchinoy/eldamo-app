package main

import (
	"bytes"
	"database/sql"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	sqlite_vec "github.com/asg017/sqlite-vec-go-bindings/cgo"
	_ "github.com/mattn/go-sqlite3"
)

type BenchmarkQuery struct {
	Query           string  `json:"query"`
	Type            string  `json:"type"`
	ExpectedPageIDs []int64 `json:"expected_page_ids"`
}

type Metrics struct {
	MRR   float64
	R5    float64
	R10   float64
	Count int
}

func serializeFloat32(vec []float32) []byte {
	buf := make([]byte, len(vec)*4)
	for i, v := range vec {
		u := math.Float32bits(v)
		binary.LittleEndian.PutUint32(buf[i*4:], u)
	}
	return buf
}

func fetchQueryEmbedding(apiKey, query string) ([]float32, error) {
	endpoint := "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=" + apiKey
	reqBody := map[string]interface{}{
		"model": "models/gemini-embedding-2",
		"content": map[string]interface{}{
			"parts": []map[string]string{{"text": query}},
		},
		"outputDimensionality": 768,
	}

	bodyBytes, _ := json.Marshal(reqBody)
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Post(endpoint, "application/json", bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("gemini status %d", resp.StatusCode)
	}

	var geminiResp struct {
		Embedding struct {
			Values []float32 `json:"values"`
		} `json:"embedding"`
	}
	if err := json.Unmarshal(respBytes, &geminiResp); err != nil {
		return nil, err
	}
	return geminiResp.Embedding.Values, nil
}

func main() {
	dbPath := os.Getenv("ELDAMO_DB_PATH")
	if dbPath == "" {
		dbPath = "dist/eldamo.db"
	}

	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		fmt.Printf("Error: Database file not found at %s\n", dbPath)
		fmt.Println("Run 'make build-db-fts' or 'make build-db' first.")
		os.Exit(1)
	}

	queriesPath := filepath.Join("spike", "data", "annotated_queries.json")
	queryBytes, err := os.ReadFile(queriesPath)
	if err != nil {
		fmt.Printf("Error reading queries file %s: %v\n", queriesPath, err)
		os.Exit(1)
	}

	var queries []BenchmarkQuery
	if err := json.Unmarshal(queryBytes, &queries); err != nil {
		fmt.Printf("Error parsing JSON queries: %v\n", err)
		os.Exit(1)
	}

	sqlite_vec.Auto()
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		fmt.Printf("Failed to open SQLite database: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	var vectorCount int
	_ = db.QueryRow("SELECT COUNT(*) FROM word_vectors").Scan(&vectorCount)

	apiKey := os.Getenv("GEMINI_API_KEY")
	hasVectorEval := vectorCount > 0 && apiKey != ""

	var mrrTotal, recall5Total, recall10Total float64
	var evalCount int
	byType := make(map[string]*Metrics)

	for _, q := range queries {
		if len(q.ExpectedPageIDs) == 0 {
			continue
		}

		if _, exists := byType[q.Type]; !exists {
			byType[q.Type] = &Metrics{}
		}

		var retrievedPIDs []int64

		if q.Type == "english_semantic" && hasVectorEval {
			emb, err := fetchQueryEmbedding(apiKey, q.Query)
			if err == nil {
				rawBytes := serializeFloat32(emb)
				rows, err := db.Query(`
					SELECT w.page_id
					FROM word_vectors v
					JOIN words w ON v.page_id = w.page_id
					WHERE v.embedding MATCH ? AND k = 10
					ORDER BY v.distance
				`, rawBytes)
				if err == nil {
					for rows.Next() {
						var pid int64
						if err := rows.Scan(&pid); err == nil {
							retrievedPIDs = append(retrievedPIDs, pid)
						}
					}
					rows.Close()
				}
			}
		}

		if len(retrievedPIDs) == 0 {
			cleanQ := fmt.Sprintf("%s*", q.Query)
			rows, err := db.Query(`
				SELECT w.page_id
				FROM word_fts f
				JOIN words w ON f.rowid = w.page_id
				WHERE word_fts MATCH ?
				ORDER BY rank
				LIMIT 10
			`, cleanQ)

			if err == nil {
				for rows.Next() {
					var pid int64
					if err := rows.Scan(&pid); err == nil {
						retrievedPIDs = append(retrievedPIDs, pid)
					}
				}
				rows.Close()
			}
		}

		expectedSet := make(map[int64]bool)
		for _, id := range q.ExpectedPageIDs {
			expectedSet[id] = true
		}

		mrr := 0.0
		for rank, pid := range retrievedPIDs {
			if expectedSet[pid] {
				mrr = 1.0 / float64(rank+1)
				break
			}
		}

		r5 := 0.0
		for i := 0; i < len(retrievedPIDs) && i < 5; i++ {
			if expectedSet[retrievedPIDs[i]] {
				r5 = 1.0
				break
			}
		}

		r10 := 0.0
		for _, pid := range retrievedPIDs {
			if expectedSet[pid] {
				r10 = 1.0
				break
			}
		}

		evalCount++
		mrrTotal += mrr
		recall5Total += r5
		recall10Total += r10

		byType[q.Type].Count++
		byType[q.Type].MRR += mrr
		byType[q.Type].R5 += r5
		byType[q.Type].R10 += r10
	}

	fmt.Println("\n======================================================")
	fmt.Printf("--- Eldamo Active Database Search Benchmark (Go Engine) ---\n")
	fmt.Printf("Database: %s (%d vector embeddings indexed)\n", dbPath, vectorCount)
	fmt.Println("======================================================")

	overallMRR := 0.0
	overallR5 := 0.0
	overallR10 := 0.0
	if evalCount > 0 {
		overallMRR = mrrTotal / float64(evalCount)
		overallR5 = recall5Total / float64(evalCount)
		overallR10 = recall10Total / float64(evalCount)
	}

	fmt.Printf("\nEvaluated on %d ground-truth queries across dataset:\n", evalCount)
	fmt.Printf("  Overall MRR:       %.4f\n", overallMRR)
	fmt.Printf("  Overall Recall@5:  %.4f\n", overallR5)
	fmt.Printf("  Overall Recall@10: %.4f\n", overallR10)

	fmt.Println("\nScore Breakdown by Query Category:")
	for qt, m := range byType {
		if m.Count > 0 {
			catMRR := m.MRR / float64(m.Count)
			catR5 := m.R5 / float64(m.Count)
			catR10 := m.R10 / float64(m.Count)

			label := strings.Title(strings.ReplaceAll(qt, "_", " "))
			fmt.Printf("  • %s (%d queries):\n", label, m.Count)
			fmt.Printf("      MRR = %.4f | Recall@5 = %.4f | Recall@10 = %.4f\n", catMRR, catR5, catR10)
		}
	}
}
