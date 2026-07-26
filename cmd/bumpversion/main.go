package main

import (
	"flag"
	"fmt"
	"os"
	"regexp"
	"strings"
)

type FileReplacement struct {
	Path    string
	Regex   *regexp.Regexp
	ReplFmt string
}

func main() {
	versionFlag := flag.String("version", "", "Target semver version string (e.g. 0.1.4)")
	flag.Parse()

	targetVersion := strings.TrimSpace(*versionFlag)
	targetVersion = strings.TrimPrefix(targetVersion, "v")

	semverRegex := regexp.MustCompile(`^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$`)
	if targetVersion == "" || !semverRegex.MatchString(targetVersion) {
		fmt.Printf("Error: Invalid or missing -version flag '%s'. Expected format: X.Y.Z (e.g. 0.1.4)\n", *versionFlag)
		os.Exit(1)
	}

	appGoPath := "internal/app/app.go"
	appGoData, err := os.ReadFile(appGoPath)
	if err != nil {
		fmt.Printf("Error reading %s: %v\n", appGoPath, err)
		os.Exit(1)
	}

	currVersionRegex := regexp.MustCompile(`const AppVersion = "([^"]+)"`)
	matches := currVersionRegex.FindStringSubmatch(string(appGoData))
	if len(matches) < 2 {
		fmt.Println("Error: Could not determine current AppVersion in internal/app/app.go")
		os.Exit(1)
	}
	currentVersion := matches[1]

	if currentVersion == targetVersion {
		fmt.Printf("Current version is already v%s. Nothing to update.\n", targetVersion)
		return
	}

	fmt.Printf("=== Eldamo App Version Bumper ===\n")
	fmt.Printf("Bumping version: v%s → v%s\n\n", currentVersion, targetVersion)

	targets := []FileReplacement{
		{
			Path:    "internal/app/app.go",
			Regex:   regexp.MustCompile(`const AppVersion = "` + regexp.QuoteMeta(currentVersion) + `"`),
			ReplFmt: `const AppVersion = "` + targetVersion + `"`,
		},
		{
			Path:    "wails.json",
			Regex:   regexp.MustCompile(`"productVersion": "` + regexp.QuoteMeta(currentVersion) + `"`),
			ReplFmt: `"productVersion": "` + targetVersion + `"`,
		},
		{
			Path:    "frontend/package.json",
			Regex:   regexp.MustCompile(`"version": "` + regexp.QuoteMeta(currentVersion) + `"`),
			ReplFmt: `"version": "` + targetVersion + `"`,
		},
		{
			Path:    "frontend/src/api.ts",
			Regex:   regexp.MustCompile(`return "` + regexp.QuoteMeta(currentVersion) + `" as unknown as T`),
			ReplFmt: `return "` + targetVersion + `" as unknown as T`,
		},
		{
			Path:    "frontend/src/components/about-modal.ts",
			Regex:   regexp.MustCompile(`this\.version = "` + regexp.QuoteMeta(currentVersion) + `"`),
			ReplFmt: `this.version = "` + targetVersion + `"`,
		},
		{
			Path:    "frontend/src/components/about-modal.ts",
			Regex:   regexp.MustCompile(`Version \$\{this\.version \|\| "` + regexp.QuoteMeta(currentVersion) + `"}`),
			ReplFmt: `Version ${this.version || "` + targetVersion + `"}`,
		},
		{
			Path:    "frontend/src/components/status-footer.ts",
			Regex:   regexp.MustCompile(`this\.version = "` + regexp.QuoteMeta(currentVersion) + `"`),
			ReplFmt: `this.version = "` + targetVersion + `"`,
		},
		{
			Path:    "frontend/src/components/status-footer.ts",
			Regex:   regexp.MustCompile(`Eldamo App v\$\{this\.version \|\| "` + regexp.QuoteMeta(currentVersion) + `"}`),
			ReplFmt: `Eldamo App v${this.version || "` + targetVersion + `"}`,
		},
	}

	updatedFiles := make(map[string]int)

	for _, target := range targets {
		data, err := os.ReadFile(target.Path)
		if err != nil {
			fmt.Printf("❌ Failed to read %s: %v\n", target.Path, err)
			os.Exit(1)
		}

		content := string(data)
		if !target.Regex.MatchString(content) {
			fmt.Printf("⚠️  Warning: Pattern %s not found in %s\n", target.Regex.String(), target.Path)
			continue
		}

		newContent := target.Regex.ReplaceAllString(content, target.ReplFmt)
		if err := os.WriteFile(target.Path, []byte(newContent), 0644); err != nil {
			fmt.Printf("❌ Failed to write %s: %v\n", target.Path, err)
			os.Exit(1)
		}
		updatedFiles[target.Path]++
	}

	for path := range updatedFiles {
		fmt.Printf("  ✓ Updated %s\n", path)
	}

	fmt.Printf("\nVersion bump to v%s completed across %d files!\n", targetVersion, len(updatedFiles))
	fmt.Println("Next steps:")
	fmt.Println("  1. Run 'make check' to verify TypeScript and Go builds")
	fmt.Printf("  2. git commit -am \"chore: bump version to v%s\"\n", targetVersion)
	fmt.Printf("  3. git tag v%s && git push origin main && git push origin v%s\n", targetVersion, targetVersion)
}
