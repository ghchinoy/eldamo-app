import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

const ALPHABET = ["ALL", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];

@customElement("eldamo-browse-bar")
export class EldamoBrowseBar extends LitElement {
  @property({ type: String }) selectedLetter = "ALL";
  @property({ type: String }) selectedLanguage = "";
  @property({ type: Number }) currentPage = 1;
  @property({ type: Number }) totalCount = 0;
  @property({ type: Number }) pageSize = 50;
  @property({ type: Array }) languages: Array<{ id: string; name: string }> = [];

  static styles = css`
    :host {
      display: block;
      margin-bottom: 1.5rem;
    }

    .browse-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      background-color: var(--eldamo-surface);
      border: 1px solid var(--eldamo-surface-border);
      border-radius: 8px;
      padding: 1.25rem;
    }

    .letter-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }

    .letter-btn {
      min-width: 2rem;
    }

    .controls-row {
      display: flex;
      gap: 1rem;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
    }

    .pagination {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.9rem;
      color: var(--eldamo-text-secondary);
    }
  `;

  private handleLetterClick(letter: string) {
    this.selectedLetter = letter;
    this.currentPage = 1;
    this.emitBrowseChange();
  }

  private handleLanguageChange(e: CustomEvent) {
    const target = e.target as HTMLSelectElement;
    this.selectedLanguage = target.value;
    this.currentPage = 1;
    this.emitBrowseChange();
  }

  private handlePrevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.emitBrowseChange();
    }
  }

  private handleNextPage() {
    const maxPage = Math.ceil(this.totalCount / this.pageSize) || 1;
    if (this.currentPage < maxPage) {
      this.currentPage++;
      this.emitBrowseChange();
    }
  }

  private emitBrowseChange() {
    this.dispatchEvent(
      new CustomEvent("browse-change", {
        detail: {
          letter: this.selectedLetter,
          lang: this.selectedLanguage,
          page: this.currentPage,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    const maxPage = Math.ceil(this.totalCount / this.pageSize) || 1;

    return html`
      <div class="browse-container">
        <div class="letter-strip">
          ${ALPHABET.map(
            (char) => html`
              <sl-button
                class="letter-btn"
                size="small"
                variant=${this.selectedLetter === char ? "primary" : "default"}
                @click=${() => this.handleLetterClick(char)}
              >
                ${char}
              </sl-button>
            `
          )}
        </div>

        <div class="controls-row">
          <sl-select
            placeholder="All Languages"
            clearable
            value=${this.selectedLanguage}
            @sl-change=${this.handleLanguageChange}
            style="min-width: 220px;"
          >
            <sl-option value="">All Languages</sl-option>
            ${this.languages.map(
              (l) => html`<sl-option value=${l.id}>${l.name} (${l.id})</sl-option>`
            )}
          </sl-select>

          <div class="pagination">
            <sl-button
              size="small"
              ?disabled=${this.currentPage <= 1}
              @click=${this.handlePrevPage}
            >
              ← Prev
            </sl-button>
            <span>Page ${this.currentPage} of ${maxPage} (${this.totalCount} entries)</span>
            <sl-button
              size="small"
              ?disabled=${this.currentPage >= maxPage}
              @click=${this.handleNextPage}
            >
              Next →
            </sl-button>
          </div>
        </div>
      </div>
    `;
  }
}
