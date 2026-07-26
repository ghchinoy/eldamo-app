package app

import (
	"eldamo-app/internal/db"
	"strings"
	"testing"
)

func TestGeminiModelPersistence(t *testing.T) {
	app := NewApp()
	
	// Set custom model
	err := app.SetGeminiModel("gemini-3.6-flash")
	if err != nil {
		t.Fatalf("SetGeminiModel failed: %v", err)
	}

	modelPtr, err := app.GetGeminiModel()
	if err != nil || modelPtr == nil {
		t.Fatalf("GetGeminiModel failed: %v", err)
	}

	if *modelPtr != "gemini-3.6-flash" {
		t.Errorf("expected gemini-3.6-flash, got %s", *modelPtr)
	}

	// Reset to default
	_ = app.SetGeminiModel(DefaultGeminiModel)
}

func TestAskAssistantFallbacks(t *testing.T) {
	app := NewApp()
	
	// Explicitly try loading project root db if ResolveDBPath didn't catch it
	dbPath := db.ResolveDBPath()
	if dbPath == "" {
		dbPath = "../../dist/eldamo.db"
	}

	if database, err := db.NewDatabase(dbPath); err == nil {
		app.db = database
		defer app.db.Close()
	} else {
		t.Skipf("Eldamo database not found at %s (%v), skipping live AskAssistant tests", dbPath, err)
	}

	// 1. Test invalid model with real API key -> must gracefully fall back to search results
	apiKeyPtr, _ := app.GetAPIKey()
	if apiKeyPtr != nil && *apiKeyPtr != "" {
		_ = app.SetGeminiModel("gemini-nonexistent-model-999")
		res, err := app.AskAssistant("What is the Quenya word for star?")
		if err != nil {
			t.Fatalf("AskAssistant failed unexpectedly: %v", err)
		}

		if !strings.Contains(res.Answer, "Here are the top matching lexicon entries") {
			t.Errorf("expected search fallback for invalid model, got: %s", res.Answer)
		}
		if !strings.Contains(res.Answer, "AI response unavailable") {
			t.Errorf("expected 'AI response unavailable' note in fallback answer, got: %s", res.Answer)
		}

		// 2. Test valid default model -> must return real AI answer
		_ = app.SetGeminiModel(DefaultGeminiModel)
		resValid, err := app.AskAssistant("What is the Quenya word for star?")
		if err != nil {
			t.Fatalf("AskAssistant with valid model failed: %v", err)
		}

		if strings.Contains(resValid.Answer, "AI response unavailable") {
			t.Errorf("valid model returned fallback error note: %s", resValid.Answer)
		}

		if len(resValid.Answer) == 0 {
			t.Errorf("expected non-empty AI answer for valid prompt")
		}
		t.Logf("Valid AI Answer snippet: %s", resValid.Answer)
	}

	// 3. Test AskAssistant with NO API key configured
	// Temporarily clear key in memory/test
	origKey, _ := app.GetAPIKey()
	if origKey != nil {
		defer app.SetAPIKey(*origKey)
	}
	_ = app.SetAPIKey("")

	resNoKey, err := app.AskAssistant("star")
	if err != nil {
		t.Fatalf("AskAssistant without key failed: %v", err)
	}
	if !strings.Contains(resNoKey.Answer, "Here are the top matching lexicon entries") {
		t.Errorf("expected search fallback when key is missing, got: %s", resNoKey.Answer)
	}
	if !strings.Contains(resNoKey.Answer, "Add a Gemini API Key in Settings") {
		t.Errorf("expected 'Add a Gemini API Key in Settings' in no-key answer, got: %s", resNoKey.Answer)
	}
}
