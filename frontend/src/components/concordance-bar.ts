import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { SourceMeta } from "../api";

@customElement("eldamo-concordance-bar")
export class EldamoConcordanceBar extends LitElement {
  @property({ type: Array }) sources: SourceMeta[] = [];
  @state() private mode: "root" | "source" = "root";
  @state() private rootQuery = "KAL";
  @state() private selectedSource = "PE17";

  static styles = css`
    :host {
      display: block;
      margin-bottom: 1.5rem;
    }

    .concordance-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      background-color: var(--eldamo-surface);
      border: 1px solid var(--eldamo-surface-border);
      border-radius: 8px;
      padding: 1.25rem;
    }

    .row {
      display: flex;
      gap: 1rem;
      align-items: center;
      flex-wrap: wrap;
    }

    sl-input, sl-select {
      flex: 1;
      min-width: 220px;
    }

    .label {
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--eldamo-gold);
      margin-bottom: 0.25rem;
    }
  `;

  private handleModeChange(mode: "root" | "source") {
    this.mode = mode;
    this.emitConcordanceChange();
  }

  private handleRootInput(e: CustomEvent) {
    const target = e.target as HTMLInputElement;
    this.rootQuery = target.value;
    this.emitConcordanceChange();
  }

  private handleSourceSelect(e: CustomEvent) {
    const target = e.target as HTMLSelectElement;
    this.selectedSource = target.value;
    this.emitConcordanceChange();
  }

  private emitConcordanceChange() {
    this.dispatchEvent(
      new CustomEvent("concordance-change", {
        detail: {
          mode: this.mode,
          query: this.mode === "root" ? this.rootQuery : this.selectedSource,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    return html`
      <div class="concordance-container">
        <div class="row">
          <sl-button-group>
            <sl-button
              variant=${this.mode === "root" ? "primary" : "default"}
              size="small"
              @click=${() => this.handleModeChange("root")}
            >
              <sl-icon name="tree" slot="prefix"></sl-icon>
              Root Stem Concordance
            </sl-button>
            <sl-button
              variant=${this.mode === "source" ? "primary" : "default"}
              size="small"
              @click=${() => this.handleModeChange("source")}
            >
              <sl-icon name="journal-bookmark" slot="prefix"></sl-icon>
              Bibliographic Source Citations
            </sl-button>
          </sl-button-group>
        </div>

        <div class="row">
          ${this.mode === "root"
            ? html`
                <div style="flex: 1;">
                  <div class="label">Etymological Root Stem (e.g. 'KAL', 'EL', 'GAL')</div>
                  <sl-input
                    placeholder="Enter root stem..."
                    value=${this.rootQuery}
                    clearable
                    @sl-input=${this.handleRootInput}
                  >
                    <sl-icon name="search" slot="prefix"></sl-icon>
                  </sl-input>
                </div>
              `
            : html`
                <div style="flex: 1;">
                  <div class="label">Primary Source Citation (e.g. PE17, Let, WJ)</div>
                  <sl-select
                    placeholder="Select source..."
                    value=${this.selectedSource}
                    @sl-change=${this.handleSourceSelect}
                  >
                    ${this.sources.map(
                      (s) => html`
                        <sl-option value=${s.source}>
                          [${s.source}] — ${s.word_count.toLocaleString()} citations
                        </sl-option>
                      `
                    )}
                  </sl-select>
                </div>
              `}
        </div>
      </div>
    `;
  }
}
