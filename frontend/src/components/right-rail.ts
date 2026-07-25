import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { FullEntryDetail } from "./entry-detail-modal";
import { transcribe, mapLanguageToMode } from "../services/glaemscribe";
import { tengwarStyles } from "../styles/tengwar-styles";

@customElement("eldamo-right-rail")
export class EldamoRightRail extends LitElement {
  @property({ type: Object }) detail: FullEntryDetail | null = null;
  @property({ type: Boolean }) loading = false;
  @property({ type: Boolean }) open = false;

  @state() private tengwarText = "";
  private currentRequestId = 0;

  static styles = [
    tengwarStyles,
    css`
      :host {
        display: block;
        height: 100%;
        background-color: var(--eldamo-surface);
        border-left: 1px solid var(--eldamo-surface-border);
        box-sizing: border-box;
      }

      .rail-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 360px;
        box-sizing: border-box;
      }

      .rail-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.85rem 1rem;
        border-bottom: 1px solid var(--eldamo-surface-border);
        background-color: var(--eldamo-bg);
      }

      .rail-title {
        font-family: var(--eldamo-font-serif);
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--eldamo-gold-bright);
        margin: 0;
      }

      .rail-body {
        flex: 1;
        overflow-y: auto;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }

      .headword-box {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }

      .headword {
        font-family: var(--eldamo-font-serif);
        font-size: 1.6rem;
        font-weight: 700;
        color: var(--eldamo-gold-bright);
      }

      .tengwar-sub {
        font-size: 1.5rem;
        line-height: 1.2;
      }

      .badges-row {
        display: flex;
        gap: 0.4rem;
        align-items: center;
        margin-top: 0.25rem;
      }

      .section {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }

      .section-title {
        font-size: 0.8rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--eldamo-gold);
        border-bottom: 1px solid var(--eldamo-surface-border);
        padding-bottom: 0.25rem;
      }

      .notes-text {
        font-size: 0.9rem;
        color: var(--eldamo-text-primary);
        line-height: 1.5;
        white-space: pre-wrap;
      }

      .relation-item {
        font-size: 0.85rem;
        color: var(--eldamo-text-primary);
        padding: 0.35rem 0.5rem;
        border-radius: 6px;
        background-color: var(--md-sys-color-surface-container-high, rgba(255, 255, 255, 0.04));
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .ref-link {
        color: var(--eldamo-gold-bright);
        text-decoration: underline;
        cursor: pointer;
        font-weight: 600;
      }

      .ref-link:hover {
        color: var(--eldamo-accent);
      }

      .source-cite {
        font-family: monospace;
        font-size: 0.8rem;
        color: var(--eldamo-accent-blue);
      }

      .empty-state {
        text-align: center;
        padding: 3rem 1rem;
        color: var(--eldamo-text-secondary);
        font-size: 0.9rem;
      }
    `,
  ];

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has("detail") && this.detail?.entry) {
      const mode = mapLanguageToMode(this.detail.entry.l);
      const reqId = ++this.currentRequestId;
      transcribe(this.detail.entry.v, mode)
        .then((t) => {
          if (this.currentRequestId === reqId) {
            this.tengwarText = t;
          }
        })
        .catch(() => {
          if (this.currentRequestId === reqId) {
            this.tengwarText = "";
          }
        });
    }
  }

  private handleClose() {
    this.dispatchEvent(new CustomEvent("close-rail", { bubbles: true, composed: true }));
  }

  private handleNavigateRef(pageID: number) {
    this.dispatchEvent(
      new CustomEvent("select-entry", {
        detail: { page_id: pageID },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    if (!this.open) return html``;

    const entry = this.detail?.entry;
    const refs = this.detail?.refs || [];
    const derivations = this.detail?.derivations || [];
    const cognates = this.detail?.cognates || [];
    const children = this.detail?.children || [];

    return html`
      <div class="rail-container">
        <div class="rail-header">
          <h2 class="rail-title">Entry Details</h2>
          <sl-icon-button name="x-lg" label="Close Panel" @click=${this.handleClose}></sl-icon-button>
        </div>

        <div class="rail-body">
          ${this.loading
            ? html`<sl-spinner style="font-size: 2rem; display: block; margin: 3rem auto;"></sl-spinner>`
            : entry
            ? html`
                <div class="headword-box">
                  <div class="headword">${entry.v}</div>
                  ${this.tengwarText
                    ? html`<div class="tengwar-text tengwar-sub">${this.tengwarText}</div>`
                    : ""}
                  <div class="badges-row">
                    <sl-badge variant="primary">${entry.l}</sl-badge>
                    ${entry.speech ? html`<sl-badge variant="neutral">${entry.speech}</sl-badge>` : ""}
                    ${entry.mark ? html`<sl-badge variant="warning">${entry.mark}</sl-badge>` : ""}
                  </div>
                </div>

                <div class="section">
                  <div class="section-title">Gloss / Translation</div>
                  <div class="notes-text">${entry.gloss || "(No direct gloss)"}</div>
                </div>

                ${entry.notes_clean
                  ? html`
                      <div class="section">
                        <div class="section-title">Etymology & Notes</div>
                        <div class="notes-text">${entry.notes_clean}</div>
                      </div>
                    `
                  : ""}

                ${derivations.length > 0
                  ? html`
                      <div class="section">
                        <div class="section-title">Etymological Derivations</div>
                        ${derivations.map(
                          (d) => html`
                            <div class="relation-item">
                              <span>
                                ${d.resolved_page_id
                                  ? html`<span class="ref-link" @click=${() => this.handleNavigateRef(d.resolved_page_id!)}>${d.source_v}</span>`
                                  : html`<strong>${d.source_v}</strong>`}
                                ${d.source_lang ? ` (${d.source_lang})` : ""}
                              </span>
                            </div>
                          `
                        )}
                      </div>
                    `
                  : ""}

                ${cognates.length > 0
                  ? html`
                      <div class="section">
                        <div class="section-title">Cross-Language Cognates</div>
                        ${cognates.map(
                          (c) => html`
                            <div class="relation-item">
                              <span>
                                ${c.resolved_page_id
                                  ? html`<span class="ref-link" @click=${() => this.handleNavigateRef(c.resolved_page_id!)}>${c.cognate_v}</span>`
                                  : html`<strong>${c.cognate_v}</strong>`}
                                ${c.cognate_lang ? ` (${c.cognate_lang})` : ""}
                              </span>
                            </div>
                          `
                        )}
                      </div>
                    `
                  : ""}

                ${children.length > 0
                  ? html`
                      <div class="section">
                        <div class="section-title">Derived Words / Children (${children.length})</div>
                        ${children.map(
                          (child) => html`
                            <div class="relation-item">
                              <span
                                class="ref-link"
                                @click=${() => this.handleNavigateRef(child.page_id)}
                              >
                                ${child.v} (${child.l})
                              </span>
                              <span>${child.gloss || ""}</span>
                            </div>
                          `
                        )}
                      </div>
                    `
                  : ""}

                ${refs.length > 0
                  ? html`
                      <div class="section">
                        <div class="section-title">Source Attestations (${refs.length})</div>
                        ${refs.map(
                          (r) => html`
                            <div class="relation-item">
                              <div>
                                <span class="source-cite">[${r.source}]</span>
                                <strong>${r.v}</strong> ${r.gloss ? `— ${r.gloss}` : ""}
                              </div>
                            </div>
                          `
                        )}
                      </div>
                    `
                  : ""}
              `
            : html`<div class="empty-state">Select an entry from search or history to inspect details.</div>`}
        </div>
      </div>
    `;
  }
}
