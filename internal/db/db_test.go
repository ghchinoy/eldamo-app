package db

import (
	"os"
	"path/filepath"
	"testing"
)

func TestGetWritableDBPath(t *testing.T) {
	path := GetWritableDBPath()
	if path == "" {
		t.Fatalf("GetWritableDBPath returned empty string")
	}

	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatalf("failed to create directory for writable db path %s: %v", dir, err)
	}

	// Verify path directory is writable
	testFile := filepath.Join(dir, ".test_write_perm")
	if err := os.WriteFile(testFile, []byte("ok"), 0644); err != nil {
		t.Fatalf("directory %s is not writable: %v", dir, err)
	}
	_ = os.Remove(testFile)
}

func TestResolveDBPathUserDirFallback(t *testing.T) {
	path := ResolveDBPath()
	t.Logf("ResolveDBPath resolved to: '%s'", path)
}
