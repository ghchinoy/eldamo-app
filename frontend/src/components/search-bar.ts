import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("eldamo-search-bar")
export class EldamoSearchBar extends LitElement {
  @property({ type: String }) query = "";
  @property({ type: String }) selectedLanguage = "";
  @property({ type: String }) searchMode: "fts" | "vector" = "fts";
  @property({ type: Number }) minSimilarity = 0.65;
  @property({ type: Number }) limit = 30;
  @property({ type: Array }) languages: Array<{ id: string; name: string }> = [];

  static styles = css`
    :host {
      display: block;
      margin-bottom: 1.5rem;
    }

    .search-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      background-color: var(--eldamo-surface);
      border: 1px solid var(--eldamo-surface-border);
      border-radius: 8px;
      padding: 1.25rem;
    }

    .main-row {
      display: flex;
      gap: 0.75rem;
      align-items: center;
    }

    sl-input {
      flex: 1;
    }

    .filters-row {
      display: flex;
      gap: 1rem;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
    }

    .filter-group {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      flex-wrap: wrap;
    }
  `;

  private handleInput(e: CustomEvent) {
    const target = e.target as HTMLInputElement;
    this.query = target.value;
    this.emitSearchChange();
  }

  private handleLanguageChange(e: CustomEvent) {
    const target = e.target as HTMLSelectElement;
    this.selectedLanguage = target.value;
    this.emitSearchChange();
  }

  private handleModeChange(mode: "fts" | "vector") {
    this.searchMode = mode;
    this.emitSearchChange();
  }

  private handleSimilarityChange(e: CustomEvent) {
    const target = e.target as HTMLSelectElement;
    this.minSimilarity = parseFloat(target.value);
    this.emitSearchChange();
  }

  private emitSearchChange() {
    this.dispatchEvent(
      new CustomEvent("search-change", {
        detail: {
          query: this.query,
          lang: this.selectedLanguage,
          mode: this.searchMode,
          minSimilarity: this.minSimilarity,
          limit: this.limit,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    return html`
      <div class="search-container">
        <div class="main-row">
          <sl-input
            placeholder="Search Elvish words, meanings, or concepts (e.g. 'star', 'elen', 'calë')..."
            value=${this.query}
            clearable
            @sl-input=${this.handleInput}
          >
            <sl-icon name="search" slot="prefix"></sl-icon>
          </sl-input>
        </div>

        <div class="filters-row">
          <div class="filter-group">
            <sl-select
              placeholder="All Languages"
              clearable
              value=${this.selectedLanguage}
              @sl-change=${this.handleLanguageChange}
              style="min-width: 180px;"
            >
              <sl-option value="">All Languages</sl-option>
              ${this.languages.map(
                (l) => html`<sl-option value=${l.id}>${l.name} (${l.id})</sl-option>`
              )}
            </sl-select>

            ${this.searchMode === "vector"
              ? html`
                  <sl-select
                    placeholder="Min Match Threshold"
                    value=${this.minSimilarity.toString()}
                    @sl-change=${this.handleSimilarityChange}
                    style="min-width: 170px;"
                  >
                    <sl-option value="0.5">Min 50% Match</sl-option>
                    <sl-option value="0.65">Min 65% Match</sl-option>
                    <sl-option value="0.75">Min 75% Match</sl-option>
                    <sl-option value="0.85">Min 85% Match</sl-option>
                  </sl-select>
                `
              : ""}
          </div>

          <div class="filter-group">
            <sl-button-group>
              <sl-button
                variant=${this.searchMode === "fts" ? "primary" : "default"}
                size="small"
                @click=${() => this.handleModeChange("fts")}
              >
                Exact / FTS Match
              </sl-button>
              <sl-button
                variant=${this.searchMode === "vector" ? "primary" : "default"}
                size="small"
                @click=${() => this.handleModeChange("vector")}
              >
                Semantic Vector Search
              </sl-button>
            </sl-button-group>
          </div>
        </div>
      </div>
    `;
  }
}
