import { LitElement, html, css } from "lit";
import { customElement, property, state, query } from "lit/decorators.js";
import { WordEntry } from "./result-card";
import { transcribe, mapLanguageToMode } from "../services/glaemscribe";
import { tengwarStyles } from "../styles/tengwar-styles";

export interface FullEntryDetail {
  entry: WordEntry;
  refs: Array<{ source: string; v: string; gloss: string }>;
  derivations: Array<{ source_v: string; source_lang?: string; ref_source?: string; resolved_page_id?: number }>;
  cognates: Array<{ cognate_v: string; cognate_lang?: string; ref_source?: string; resolved_page_id?: number }>;
  children: Array<WordEntry>;
}

@customElement("eldamo-entry-detail-modal")
export class EldamoEntryDetailModal extends LitElement {
  @property({ type: Object }) detail: FullEntryDetail | null = null;
  @property({ type: Boolean }) open = false;
  @property({ type: Boolean }) loading = false;
  @state() private tengwarText = "";

  @query("sl-dialog") private dialogElement!: HTMLElement & { show: () => void; hide: () => void };
  private currentRequestId = 0;

  static styles = [
    tengwarStyles,
    css`
    sl-dialog {
      --width: 650px;
    }

    .modal-title {
      font-family: var(--eldamo-font-serif);
      font-size: 1.6rem;
      color: var(--eldamo-gold-bright);
    }

    .content-wrapper {
      position: relative;
    }

    .content-body {
      transition: opacity 0.2s ease-in-out;
    }

    .content-body.loading {
      opacity: 0.35;
      pointer-events: none;
    }

    .spinner-overlay {
      position: absolute;
      top: 40%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 20;
    }

    .section {
      margin-top: 1.25rem;
    }

    .section-title {
      font-weight: 600;
      color: var(--eldamo-gold);
      border-bottom: 1px solid var(--eldamo-surface-border);
      padding-bottom: 0.25rem;
      margin-bottom: 0.5rem;
    }

    .ref-item, .deriv-item {
      font-size: 0.9rem;
      margin-bottom: 0.35rem;
      color: var(--eldamo-text-primary);
    }

    .source-cite {
      font-family: monospace;
      color: var(--eldamo-accent-blue);
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
  `,
  ];

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has("open")) {
      if (this.open && this.dialogElement) {
        this.dialogElement.show();
      } else if (!this.open && this.dialogElement) {
        this.dialogElement.hide();
      }
    }
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
    this.open = false;
    this.dispatchEvent(new CustomEvent("modal-closed", { bubbles: true, composed: true }));
  }

  private handleNavigateRef(pageID: number) {
    this.dispatchEvent(new CustomEvent("select-entry", { detail: { page_id: pageID }, bubbles: true, composed: true }));
  }

  render() {
    const entry = this.detail?.entry;
    const refs = this.detail?.refs;
    const derivations = this.detail?.derivations;
    const cognates = this.detail?.cognates;

    return html`
      <sl-dialog
        label=${entry ? `${entry.v} (${entry.l})` : "Word Detail"}
        .open=${this.open}
        @sl-request-close=${this.handleClose}
        @sl-after-hide=${this.handleClose}
      >
        <div class="content-wrapper">
          ${this.loading ? html`<sl-spinner class="spinner-overlay" style="font-size: 2.2rem;"></sl-spinner>` : ""}

          ${entry
            ? html`
                <div class="content-body ${this.loading ? "loading" : ""}">
                  <div class="modal-title">
                    ${entry.v}
                    ${this.tengwarText ? html`<span class="tengwar-text" style="margin-left: 0.8rem; font-size: 1.5rem;">${this.tengwarText}</span>` : ""}
                  </div>
                  <div style="margin-top: 0.5rem;">
                    <sl-badge variant="primary">${entry.l}</sl-badge>
                    ${entry.speech ? html`<sl-badge variant="neutral">${entry.speech}</sl-badge>` : ""}
                    ${entry.mark ? html`<sl-badge variant="warning">${entry.mark}</sl-badge>` : ""}
                  </div>

                  <div class="section">
                    <div class="section-title">Gloss / Translation</div>
                    <div>${entry.gloss || "(No direct gloss)"}</div>
                  </div>

                  ${entry.notes_clean
                    ? html`
                        <div class="section">
                          <div class="section-title">Etymological & Linguistic Notes</div>
                          <div>${entry.notes_clean}</div>
                        </div>
                      `
                    : ""}

                  ${refs && refs.length > 0
                    ? html`
                        <div class="section">
                          <div class="section-title">Source Attestations (${refs.length})</div>
                          ${refs.map(
                            (r) => html`
                              <div class="ref-item">
                                <span class="source-cite">[${r.source}]</span>
                                <strong>${r.v}</strong> ${r.gloss ? `— ${r.gloss}` : ""}
                              </div>
                            `
                          )}
                        </div>
                      `
                    : ""}

                  ${derivations && derivations.length > 0
                    ? html`
                        <div class="section">
                          <div class="section-title">Etymological Derivations</div>
                          ${derivations.map(
                            (d) => html`
                              <div class="deriv-item">
                                Derived from root
                                ${d.resolved_page_id
                                  ? html`<span class="ref-link" @click=${() => this.handleNavigateRef(d.resolved_page_id!)}>${d.source_v}</span>`
                                  : html`<strong>${d.source_v}</strong>`}
                                ${d.source_lang ? `(${d.source_lang})` : ""}
                              </div>
                            `
                          )}
                        </div>
                      `
                    : ""}

                  ${cognates && cognates.length > 0
                    ? html`
                        <div class="section">
                          <div class="section-title">Cross-Language Cognates</div>
                          ${cognates.map(
                            (c) => html`
                              <div class="deriv-item">
                                Cognate:
                                ${c.resolved_page_id
                                  ? html`<span class="ref-link" @click=${() => this.handleNavigateRef(c.resolved_page_id!)}>${c.cognate_v}</span>`
                                  : html`<strong>${c.cognate_v}</strong>`}
                                ${c.cognate_lang ? `(${c.cognate_lang})` : ""}
                              </div>
                            `
                          )}
                        </div>
                      `
                    : ""}
                </div>
              `
            : html`<sl-spinner style="font-size: 2rem; display: block; margin: 2rem auto;"></sl-spinner>`}
        </div>

        <sl-button slot="footer" variant="primary" @click=${this.handleClose}>
          Close
        </sl-button>
      </sl-dialog>
    `;
  }
}
