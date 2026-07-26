import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { transcribe, mapLanguageToMode } from "../services/glaemscribe";
import { tengwarStyles } from "../styles/tengwar-styles";

export interface WordEntry {
  page_id: number;
  v: string;
  l: string;
  speech: string;
  gloss: string;
  cat: string;
  mark: string;
  stem: string;
  from_v: string;
  tengwar: string;
  orthography: string;
  notes_clean: string;
  notes_raw: string;
}

export interface SearchResult {
  entry: WordEntry;
  score: number;
}

@customElement("eldamo-result-card")
export class EldamoResultCard extends LitElement {
  @property({ type: Object }) result!: SearchResult;
  @property({ type: Boolean }) showScore = false;
  @state() private tengwarText = "";

  private currentRequestId = 0;

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has("result") && this.result?.entry) {
      const mode = mapLanguageToMode(this.result.entry.l);
      const reqId = ++this.currentRequestId;
      transcribe(this.result.entry.v, mode)
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

  static styles = [
    tengwarStyles,
    css`
    :host {
      display: block;
    }

    .card-wrapper {
      width: 100%;
      cursor: pointer;
    }

    sl-card {
      width: 100%;
      pointer-events: none;
    }

    sl-card::part(base) {
      background-color: var(--eldamo-surface);
      border: 1px solid var(--eldamo-surface-border);
      border-radius: 10px;
      transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
    }

    .card-wrapper:hover sl-card::part(base) {
      transform: translateY(-2px);
      border-color: var(--eldamo-gold-bright);
      box-shadow: 0 4px 16px rgba(243, 208, 130, 0.15);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 0.5rem;
    }

    .word-form {
      font-family: var(--eldamo-font-serif);
      font-size: 1.35rem;
      font-weight: 700;
      color: var(--eldamo-gold-bright);
    }

    .meta-badges {
      display: flex;
      gap: 0.4rem;
      align-items: center;
    }

    .gloss {
      font-size: 1.05rem;
      font-weight: 600;
      color: var(--eldamo-text-primary);
      margin-bottom: 0.5rem;
      line-height: 1.4;
    }

    .notes-preview {
      font-size: 0.88rem;
      color: var(--eldamo-text-secondary);
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `,
  ];

  private handleClick(e: Event) {
    e.stopPropagation();
    console.log("Card clicked, emitting select-entry for page_id:", this.result.entry.page_id);
    this.dispatchEvent(
      new CustomEvent("select-entry", {
        detail: { page_id: this.result.entry.page_id },
        bubbles: true,
        composed: true,
      })
    );
  }

  private renderScoreBadge(score: number) {
    const clampedScore = Math.min(Math.max(score, 0), 1.0);
    const percent = Math.round(clampedScore * 100);
    let variant: "success" | "primary" | "neutral" = "neutral";
    if (percent >= 85) variant = "success";
    else if (percent >= 70) variant = "primary";

    return html`<sl-badge variant=${variant} style="font-weight: 600;">${percent}% match</sl-badge>`;
  }

  render() {
    const { entry, score } = this.result;
    return html`
      <div class="card-wrapper" @click=${this.handleClick}>
        <sl-card>
          <div class="card-header">
            <div class="word-form">
              ${entry.v}
              ${this.tengwarText ? html`<span class="tengwar-text" style="margin-left: 0.6rem; opacity: 0.9;">${this.tengwarText}</span>` : ""}
              ${entry.mark ? html`<sl-tag size="small" variant="neutral">${entry.mark}</sl-tag>` : ""}
            </div>
            <div class="meta-badges">
              ${this.showScore && score > 0 ? this.renderScoreBadge(score) : ""}
              <sl-badge variant="primary">${entry.l}</sl-badge>
              ${entry.speech ? html`<sl-badge variant="neutral">${entry.speech}</sl-badge>` : ""}
            </div>
          </div>

          <div class="gloss">
            ${entry.gloss ? entry.gloss : html`<em>(No English gloss)</em>`}
          </div>

          ${entry.notes_clean ? html`<div class="notes-preview">${entry.notes_clean}</div>` : ""}
        </sl-card>
      </div>
    `;
  }
}
