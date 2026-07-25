package db

import (
	"database/sql"
	"encoding/binary"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strings"

	sqlite_vec "github.com/asg017/sqlite-vec-go-bindings/cgo"
	_ "github.com/mattn/go-sqlite3"
)

type WordEntry struct {
	PageID       int64  `json:"page_id"`
	V            string `json:"v"`
	L            string `json:"l"`
	Speech       string `json:"speech"`
	Gloss        string `json:"gloss"`
	Cat          string `json:"cat"`
	Mark         string `json:"mark"`
	Stem         string `json:"stem"`
	FromV        string `json:"from_v"`
	Tengwar      string `json:"tengwar"`
	Orthography  string `json:"orthography"`
	ParentPageID *int64 `json:"parent_page_id,omitempty"`
	NotesClean   string `json:"notes_clean"`
	NotesRaw     string `json:"notes_raw"`
}

type SearchResult struct {
	Entry WordEntry `json:"entry"`
	Score float64   `json:"score"`
}

type BrowseResult struct {
	Entries    []WordEntry `json:"entries"`
	TotalCount int64       `json:"total_count"`
	Page       int         `json:"page"`
	PageSize   int         `json:"page_size"`
}

type WordRef struct {
	Source string `json:"source"`
	V      string `json:"v"`
	Gloss  string `json:"gloss"`
}

type WordDerivation struct {
	SourceV        string  `json:"source_v"`
	SourceLang     *string `json:"source_lang,omitempty"`
	RefSource      *string `json:"ref_source,omitempty"`
	ResolvedPageID *int64  `json:"resolved_page_id,omitempty"`
}

type WordCognate struct {
	CognateV       string  `json:"cognate_v"`
	CognateLang    *string `json:"cognate_lang,omitempty"`
	RefSource      *string `json:"ref_source,omitempty"`
	ResolvedPageID *int64  `json:"resolved_page_id,omitempty"`
}

type FullEntryDetail struct {
	Entry       WordEntry        `json:"entry"`
	Refs        []WordRef        `json:"refs"`
	Derivations []WordDerivation `json:"derivations"`
	Cognates    []WordCognate    `json:"cognates"`
	Children    []WordEntry      `json:"children"`
}

type LanguageMeta struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Era          string `json:"era"`
	DisplayOrder int    `json:"display_order"`
}

type Category struct {
	ID         string `json:"id"`
	GroupID    string `json:"group_id"`
	GroupLabel string `json:"group_label"`
	Num        string `json:"num"`
	Label      string `json:"label"`
	WordCount  int    `json:"word_count"`
}

type CategoryGroup struct {
	GroupID    string     `json:"group_id"`
	GroupLabel string     `json:"group_label"`
	Categories []Category `json:"categories"`
}

type SourceMeta struct {
	Source    string `json:"source"`
	WordCount int    `json:"word_count"`
}

type DBInfo struct {
	Exists         bool   `json:"exists"`
	Path           string `json:"path"`
	WordCount      int    `json:"word_count"`
	LanguageCount  int    `json:"language_count"`
	EmbeddingModel string `json:"embedding_model"`
	SizeBytes      int64  `json:"size_bytes"`
}

func (d *Database) GetInfo() DBInfo {
	info := DBInfo{
		Exists: true,
		Path:   d.dbPath,
	}
	if fi, err := os.Stat(d.dbPath); err == nil {
		info.SizeBytes = fi.Size()
	}
	_ = d.db.QueryRow("SELECT COUNT(*) FROM words").Scan(&info.WordCount)
	_ = d.db.QueryRow("SELECT COUNT(*) FROM languages").Scan(&info.LanguageCount)
	_ = d.db.QueryRow("SELECT value FROM meta WHERE key = 'embedding_model'").Scan(&info.EmbeddingModel)
	return info
}

type Database struct {
	dbPath string
	db     *sql.DB
}

func ResolveDBPath() string {
	cwd, err := os.Getwd()
	if err == nil {
		p1 := filepath.Join(cwd, "dist", "eldamo.db")
		if _, err := os.Stat(p1); err == nil {
			return p1
		}
		p2 := filepath.Join(filepath.Dir(cwd), "dist", "eldamo.db")
		if _, err := os.Stat(p2); err == nil {
			return p2
		}
	}
	fallback := filepath.Join("dist", "eldamo.db")
	if _, err := os.Stat(fallback); err == nil {
		return fallback
	}
	return ""
}

func NewDatabase(dbPath string) (*Database, error) {
	sqlite_vec.Auto()

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite database: %w", err)
	}

	return &Database{
		dbPath: dbPath,
		db:     db,
	}, nil
}

func (d *Database) Close() error {
	if d.db != nil {
		return d.db.Close()
	}
	return nil
}

func (d *Database) GetLanguages() ([]LanguageMeta, error) {
	rows, err := d.db.Query("SELECT id, name, COALESCE(era, ''), COALESCE(display_order, 0) FROM languages ORDER BY display_order ASC, name ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var langs []LanguageMeta
	for rows.Next() {
		var l LanguageMeta
		if err := rows.Scan(&l.ID, &l.Name, &l.Era, &l.DisplayOrder); err != nil {
			return nil, err
		}
		langs = append(langs, l)
	}
	return langs, nil
}

func sanitizeFTSQuery(raw string) string {
	cleaned := strings.Map(func(r rune) rune {
		if strings.ContainsRune(`"'*:-+()^~`, r) {
			return ' '
		}
		return r
	}, raw)
	trimmed := strings.TrimSpace(cleaned)
	if trimmed == "" {
		return ""
	}
	words := strings.Fields(trimmed)
	for i, w := range words {
		words[i] = w + "*"
	}
	return strings.Join(words, " ")
}

func (d *Database) SearchFTS(query string, lang *string, speech *string, limit int) ([]SearchResult, error) {
	ftsQuery := sanitizeFTSQuery(query)
	if ftsQuery == "" {
		return []SearchResult{}, nil
	}

	sqlStr := `SELECT w.page_id, w.v, w.l, COALESCE(w.speech, ''), COALESCE(w.gloss, ''), COALESCE(w.cat, ''), COALESCE(w.mark, ''), COALESCE(w.stem, ''), COALESCE(w.from_v, ''), COALESCE(w.tengwar, ''), COALESCE(w.orthography, ''), w.parent_page_id, COALESCE(w.notes_clean, ''), COALESCE(w.notes_raw, ''), f.rank
              FROM word_fts f
              JOIN words w ON f.rowid = w.page_id
              WHERE word_fts MATCH ? `

	var args []interface{}
	args = append(args, ftsQuery)

	if lang != nil && *lang != "" {
		sqlStr += "AND w.l = ? "
		args = append(args, *lang)
	}

	if speech != nil && *speech != "" {
		sqlStr += "AND w.speech = ? "
		args = append(args, *speech)
	}

	sqlStr += "ORDER BY rank LIMIT ?"
	args = append(args, limit)

	rows, err := d.db.Query(sqlStr, args...)
	if err != nil {
		return []SearchResult{}, nil
	}
	defer rows.Close()

	var results []SearchResult
	for rows.Next() {
		var entry WordEntry
		var parentID sql.NullInt64
		var rank float64

		err := rows.Scan(
			&entry.PageID, &entry.V, &entry.L, &entry.Speech, &entry.Gloss,
			&entry.Cat, &entry.Mark, &entry.Stem, &entry.FromV, &entry.Tengwar,
			&entry.Orthography, &parentID, &entry.NotesClean, &entry.NotesRaw, &rank,
		)
		if err != nil {
			return nil, err
		}

		if parentID.Valid {
			entry.ParentPageID = &parentID.Int64
		}

		results = append(results, SearchResult{
			Entry: entry,
			Score: -rank,
		})
	}

	return results, nil
}

func serializeFloat32(vec []float32) []byte {
	buf := make([]byte, len(vec)*4)
	for i, v := range vec {
		u := math.Float32bits(v)
		binary.LittleEndian.PutUint32(buf[i*4:], u)
	}
	return buf
}

func (d *Database) SearchVector(queryVector []float32, limit int) ([]SearchResult, error) {
	if len(queryVector) == 0 {
		return []SearchResult{}, nil
	}

	rawBytes := serializeFloat32(queryVector)

	sqlStr := `SELECT w.page_id, w.v, w.l, COALESCE(w.speech, ''), COALESCE(w.gloss, ''), COALESCE(w.cat, ''), COALESCE(w.mark, ''), COALESCE(w.stem, ''), COALESCE(w.from_v, ''), COALESCE(w.tengwar, ''), COALESCE(w.orthography, ''), w.parent_page_id, COALESCE(w.notes_clean, ''), COALESCE(w.notes_raw, ''), v.distance
              FROM word_vectors v
              JOIN words w ON v.page_id = w.page_id
              WHERE v.embedding MATCH ? AND k = ?
              ORDER BY v.distance`

	rows, err := d.db.Query(sqlStr, rawBytes, limit)
	if err != nil {
		return []SearchResult{}, nil
	}
	defer rows.Close()

	var results []SearchResult
	for rows.Next() {
		var entry WordEntry
		var parentID sql.NullInt64
		var distance float64

		err := rows.Scan(
			&entry.PageID, &entry.V, &entry.L, &entry.Speech, &entry.Gloss,
			&entry.Cat, &entry.Mark, &entry.Stem, &entry.FromV, &entry.Tengwar,
			&entry.Orthography, &parentID, &entry.NotesClean, &entry.NotesRaw, &distance,
		)
		if err != nil {
			return nil, err
		}

		if parentID.Valid {
			entry.ParentPageID = &parentID.Int64
		}

		// Clamp similarity score between 0.0 and 1.0
		similarity := 1.0 - distance
		if similarity < 0.0 {
			similarity = 0.0
		} else if similarity > 1.0 {
			similarity = 1.0
		}

		results = append(results, SearchResult{
			Entry: entry,
			Score: similarity,
		})
	}

	return results, nil
}

func vecToJSON(vec []float32) ([]byte, error) {
	var sb strings.Builder
	sb.WriteString("[")
	for i, v := range vec {
		if i > 0 {
			sb.WriteString(",")
		}
		sb.WriteString(fmt.Sprintf("%g", v))
	}
	sb.WriteString("]")
	return []byte(sb.String()), nil
}

func (d *Database) BrowseAlphabetical(letter *string, lang *string, page int, pageSize int) (BrowseResult, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 50
	}
	offset := (page - 1) * pageSize

	var whereClauses []string
	var params []interface{}

	if lang != nil && *lang != "" {
		whereClauses = append(whereClauses, "l = ?")
		params = append(params, *lang)
	}

	if letter != nil && *letter != "" && *letter != "ALL" {
		whereClauses = append(whereClauses, "lower(v) LIKE ?")
		params = append(params, strings.ToLower(*letter)+"%")
	}

	whereSQL := ""
	if len(whereClauses) > 0 {
		whereSQL = "WHERE " + strings.Join(whereClauses, " AND ")
	}

	countSQL := fmt.Sprintf("SELECT COUNT(*) FROM words %s", whereSQL)
	var totalCount int64
	err := d.db.QueryRow(countSQL, params...).Scan(&totalCount)
	if err != nil {
		return BrowseResult{}, err
	}

	querySQL := fmt.Sprintf(`SELECT page_id, v, l, COALESCE(speech, ''), COALESCE(gloss, ''), COALESCE(cat, ''), COALESCE(mark, ''), COALESCE(stem, ''), COALESCE(from_v, ''), COALESCE(tengwar, ''), COALESCE(orthography, ''), parent_page_id, COALESCE(notes_clean, ''), COALESCE(notes_raw, '')
                           FROM words %s ORDER BY lower(v) ASC, page_id ASC LIMIT ? OFFSET ?`, whereSQL)

	queryParams := append(params, pageSize, offset)
	rows, err := d.db.Query(querySQL, queryParams...)
	if err != nil {
		return BrowseResult{}, err
	}
	defer rows.Close()

	var entries []WordEntry
	for rows.Next() {
		var entry WordEntry
		var parentID sql.NullInt64

		err := rows.Scan(
			&entry.PageID, &entry.V, &entry.L, &entry.Speech, &entry.Gloss,
			&entry.Cat, &entry.Mark, &entry.Stem, &entry.FromV, &entry.Tengwar,
			&entry.Orthography, &parentID, &entry.NotesClean, &entry.NotesRaw,
		)
		if err != nil {
			return BrowseResult{}, err
		}

		if parentID.Valid {
			entry.ParentPageID = &parentID.Int64
		}

		entries = append(entries, entry)
	}

	return BrowseResult{
		Entries:    entries,
		TotalCount: totalCount,
		Page:       page,
		PageSize:   pageSize,
	}, nil
}

func (d *Database) GetFullEntry(pageID int64) (*FullEntryDetail, error) {
	var entry WordEntry
	var parentID sql.NullInt64

	row := d.db.QueryRow(`SELECT page_id, v, l, COALESCE(speech, ''), COALESCE(gloss, ''), COALESCE(cat, ''), COALESCE(mark, ''), COALESCE(stem, ''), COALESCE(from_v, ''), COALESCE(tengwar, ''), COALESCE(orthography, ''), parent_page_id, COALESCE(notes_clean, ''), COALESCE(notes_raw, '')
                          FROM words WHERE page_id = ?`, pageID)

	err := row.Scan(
		&entry.PageID, &entry.V, &entry.L, &entry.Speech, &entry.Gloss,
		&entry.Cat, &entry.Mark, &entry.Stem, &entry.FromV, &entry.Tengwar,
		&entry.Orthography, &parentID, &entry.NotesClean, &entry.NotesRaw,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	if parentID.Valid {
		entry.ParentPageID = &parentID.Int64
	}

	// Fetch refs
	refsRows, err := d.db.Query("SELECT COALESCE(source, ''), COALESCE(v, ''), COALESCE(gloss, '') FROM word_refs WHERE page_id = ?", pageID)
	if err != nil {
		return nil, err
	}
	defer refsRows.Close()

	var refs []WordRef
	for refsRows.Next() {
		var r WordRef
		if err := refsRows.Scan(&r.Source, &r.V, &r.Gloss); err != nil {
			return nil, err
		}
		refs = append(refs, r)
	}

	// Fetch derivations with cross-reference resolution
	derivRows, err := d.db.Query(`
		SELECT COALESCE(d.source_v, ''), d.source_lang, d.ref_source, w.page_id
		FROM word_derivations d
		LEFT JOIN words w ON w.v = d.source_v AND (d.source_lang IS NULL OR d.source_lang = '' OR w.l = d.source_lang)
		WHERE d.page_id = ?
		GROUP BY d.id`, pageID)
	if err != nil {
		return nil, err
	}
	defer derivRows.Close()

	var derivations []WordDerivation
	for derivRows.Next() {
		var dev WordDerivation
		var sLang, rSrc sql.NullString
		var resPID sql.NullInt64
		if err := derivRows.Scan(&dev.SourceV, &sLang, &rSrc, &resPID); err != nil {
			return nil, err
		}
		if sLang.Valid {
			dev.SourceLang = &sLang.String
		}
		if rSrc.Valid {
			dev.RefSource = &rSrc.String
		}
		if resPID.Valid {
			dev.ResolvedPageID = &resPID.Int64
		}
		derivations = append(derivations, dev)
	}

	// Fetch cognates with cross-reference resolution
	cogRows, err := d.db.Query(`
		SELECT COALESCE(c.cognate_v, ''), c.cognate_lang, c.ref_source, w.page_id
		FROM word_cognates c
		LEFT JOIN words w ON w.v = c.cognate_v AND (c.cognate_lang IS NULL OR c.cognate_lang = '' OR w.l = c.cognate_lang)
		WHERE c.page_id = ?
		GROUP BY c.id`, pageID)
	if err != nil {
		return nil, err
	}
	defer cogRows.Close()

	var cognates []WordCognate
	for cogRows.Next() {
		var cog WordCognate
		var cLang, rSrc sql.NullString
		var resPID sql.NullInt64
		if err := cogRows.Scan(&cog.CognateV, &cLang, &rSrc, &resPID); err != nil {
			return nil, err
		}
		if cLang.Valid {
			cog.CognateLang = &cLang.String
		}
		if rSrc.Valid {
			cog.RefSource = &rSrc.String
		}
		if resPID.Valid {
			cog.ResolvedPageID = &resPID.Int64
		}
		cognates = append(cognates, cog)
	}

	// Fetch children
	childRows, err := d.db.Query(`SELECT page_id, v, l, COALESCE(speech, ''), COALESCE(gloss, ''), COALESCE(cat, ''), COALESCE(mark, ''), COALESCE(stem, ''), COALESCE(from_v, ''), COALESCE(tengwar, ''), COALESCE(orthography, ''), parent_page_id, COALESCE(notes_clean, ''), COALESCE(notes_raw, '')
                                  FROM words WHERE parent_page_id = ?`, pageID)
	if err != nil {
		return nil, err
	}
	defer childRows.Close()

	var children []WordEntry
	for childRows.Next() {
		var cWord WordEntry
		var cParentID sql.NullInt64
		err := childRows.Scan(
			&cWord.PageID, &cWord.V, &cWord.L, &cWord.Speech, &cWord.Gloss,
			&cWord.Cat, &cWord.Mark, &cWord.Stem, &cWord.FromV, &cWord.Tengwar,
			&cWord.Orthography, &cParentID, &cWord.NotesClean, &cWord.NotesRaw,
		)
		if err != nil {
			return nil, err
		}
		if cParentID.Valid {
			cWord.ParentPageID = &cParentID.Int64
		}
		children = append(children, cWord)
	}

	return &FullEntryDetail{
		Entry:       entry,
		Refs:        refs,
		Derivations: derivations,
		Cognates:    cognates,
		Children:    children,
	}, nil
}

func (d *Database) GetCategoryTree() ([]CategoryGroup, error) {
	sqlStr := `
		SELECT c.id, c.group_id, c.group_label, COALESCE(c.num, ''), c.label, COUNT(w.page_id) as cnt
		FROM categories c
		LEFT JOIN words w ON w.cat = c.id
		GROUP BY c.id
		ORDER BY c.group_id ASC, c.num ASC, c.label ASC`

	rows, err := d.db.Query(sqlStr)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	groupMap := make(map[string]*CategoryGroup)
	var groupOrder []string

	for rows.Next() {
		var cat Category
		err := rows.Scan(&cat.ID, &cat.GroupID, &cat.GroupLabel, &cat.Num, &cat.Label, &cat.WordCount)
		if err != nil {
			return nil, err
		}

		group, exists := groupMap[cat.GroupID]
		if !exists {
			group = &CategoryGroup{
				GroupID:    cat.GroupID,
				GroupLabel: cat.GroupLabel,
				Categories: []Category{},
			}
			groupMap[cat.GroupID] = group
			groupOrder = append(groupOrder, cat.GroupID)
		}
		group.Categories = append(group.Categories, cat)
	}

	var result []CategoryGroup
	for _, gid := range groupOrder {
		result = append(result, *groupMap[gid])
	}
	return result, nil
}

func (d *Database) BrowseByCategory(catID string, page, pageSize int) (BrowseResult, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 50
	}
	offset := (page - 1) * pageSize

	var totalCount int64
	err := d.db.QueryRow("SELECT COUNT(*) FROM words WHERE cat = ?", catID).Scan(&totalCount)
	if err != nil {
		return BrowseResult{}, err
	}

	querySQL := `SELECT page_id, v, l, COALESCE(speech, ''), COALESCE(gloss, ''), COALESCE(cat, ''), COALESCE(mark, ''), COALESCE(stem, ''), COALESCE(from_v, ''), COALESCE(tengwar, ''), COALESCE(orthography, ''), parent_page_id, COALESCE(notes_clean, ''), COALESCE(notes_raw, '')
                 FROM words WHERE cat = ? ORDER BY lower(v) ASC, page_id ASC LIMIT ? OFFSET ?`

	rows, err := d.db.Query(querySQL, catID, pageSize, offset)
	if err != nil {
		return BrowseResult{}, err
	}
	defer rows.Close()

	var entries []WordEntry
	for rows.Next() {
		var entry WordEntry
		var parentID sql.NullInt64

		err := rows.Scan(
			&entry.PageID, &entry.V, &entry.L, &entry.Speech, &entry.Gloss,
			&entry.Cat, &entry.Mark, &entry.Stem, &entry.FromV, &entry.Tengwar,
			&entry.Orthography, &parentID, &entry.NotesClean, &entry.NotesRaw,
		)
		if err != nil {
			return BrowseResult{}, err
		}

		if parentID.Valid {
			entry.ParentPageID = &parentID.Int64
		}

		entries = append(entries, entry)
	}

	return BrowseResult{
		Entries:    entries,
		TotalCount: totalCount,
		Page:       page,
		PageSize:   pageSize,
	}, nil
}

func (d *Database) GetSourcesList() ([]SourceMeta, error) {
	rows, err := d.db.Query(`
		SELECT r.source, COUNT(DISTINCT r.page_id) as cnt
		FROM word_refs r
		GROUP BY r.source
		ORDER BY cnt DESC
		LIMIT 100`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sources []SourceMeta
	for rows.Next() {
		var s SourceMeta
		if err := rows.Scan(&s.Source, &s.WordCount); err == nil {
			sources = append(sources, s)
		}
	}
	return sources, nil
}

func (d *Database) GetConcordance(root string, page, pageSize int) (BrowseResult, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 50
	}
	offset := (page - 1) * pageSize

	matchPattern := "%" + root + "%"

	var totalCount int64
	countSQL := `SELECT COUNT(DISTINCT w.page_id)
                 FROM words w
                 LEFT JOIN word_derivations d ON d.page_id = w.page_id
                 WHERE w.from_v LIKE ? OR d.source_v LIKE ? OR w.stem LIKE ?`
	_ = d.db.QueryRow(countSQL, matchPattern, matchPattern, matchPattern).Scan(&totalCount)

	querySQL := `SELECT DISTINCT w.page_id, w.v, w.l, COALESCE(w.speech, ''), COALESCE(w.gloss, ''), COALESCE(w.cat, ''), COALESCE(w.mark, ''), COALESCE(w.stem, ''), COALESCE(w.from_v, ''), COALESCE(w.tengwar, ''), COALESCE(w.orthography, ''), w.parent_page_id, COALESCE(w.notes_clean, ''), COALESCE(w.notes_raw, '')
                 FROM words w
                 LEFT JOIN word_derivations d ON d.page_id = w.page_id
                 WHERE w.from_v LIKE ? OR d.source_v LIKE ? OR w.stem LIKE ?
                 ORDER BY lower(w.v) ASC LIMIT ? OFFSET ?`

	rows, err := d.db.Query(querySQL, matchPattern, matchPattern, matchPattern, pageSize, offset)
	if err != nil {
		return BrowseResult{}, err
	}
	defer rows.Close()

	var entries []WordEntry
	for rows.Next() {
		var entry WordEntry
		var parentID sql.NullInt64

		err := rows.Scan(
			&entry.PageID, &entry.V, &entry.L, &entry.Speech, &entry.Gloss,
			&entry.Cat, &entry.Mark, &entry.Stem, &entry.FromV, &entry.Tengwar,
			&entry.Orthography, &parentID, &entry.NotesClean, &entry.NotesRaw,
		)
		if err != nil {
			return BrowseResult{}, err
		}

		if parentID.Valid {
			entry.ParentPageID = &parentID.Int64
		}

		entries = append(entries, entry)
	}

	return BrowseResult{
		Entries:    entries,
		TotalCount: totalCount,
		Page:       page,
		PageSize:   pageSize,
	}, nil
}

func (d *Database) GetAttestationsBySource(source string, page, pageSize int) (BrowseResult, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 50
	}
	offset := (page - 1) * pageSize

	matchPattern := source + "%"

	var totalCount int64
	countSQL := `SELECT COUNT(DISTINCT w.page_id)
                 FROM words w
                 JOIN word_refs r ON r.page_id = w.page_id
                 WHERE r.source LIKE ?`
	_ = d.db.QueryRow(countSQL, matchPattern).Scan(&totalCount)

	querySQL := `SELECT DISTINCT w.page_id, w.v, w.l, COALESCE(w.speech, ''), COALESCE(w.gloss, ''), COALESCE(w.cat, ''), COALESCE(w.mark, ''), COALESCE(w.stem, ''), COALESCE(w.from_v, ''), COALESCE(w.tengwar, ''), COALESCE(w.orthography, ''), w.parent_page_id, COALESCE(w.notes_clean, ''), COALESCE(w.notes_raw, '')
                 FROM words w
                 JOIN word_refs r ON r.page_id = w.page_id
                 WHERE r.source LIKE ?
                 ORDER BY lower(w.v) ASC LIMIT ? OFFSET ?`

	rows, err := d.db.Query(querySQL, matchPattern, pageSize, offset)
	if err != nil {
		return BrowseResult{}, err
	}
	defer rows.Close()

	var entries []WordEntry
	for rows.Next() {
		var entry WordEntry
		var parentID sql.NullInt64

		err := rows.Scan(
			&entry.PageID, &entry.V, &entry.L, &entry.Speech, &entry.Gloss,
			&entry.Cat, &entry.Mark, &entry.Stem, &entry.FromV, &entry.Tengwar,
			&entry.Orthography, &parentID, &entry.NotesClean, &entry.NotesRaw,
		)
		if err != nil {
			return BrowseResult{}, err
		}

		if parentID.Valid {
			entry.ParentPageID = &parentID.Int64
		}

		entries = append(entries, entry)
	}

	return BrowseResult{
		Entries:    entries,
		TotalCount: totalCount,
		Page:       page,
		PageSize:   pageSize,
	}, nil
}
