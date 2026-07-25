import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { transcribe, MODES, CHARSETS } from "../services/glaemscribe";
import { tengwarStyles } from "../styles/tengwar-styles";

@customElement("eldamo-transliterator-bar")
export class EldamoTransliteratorBar extends LitElement {
  @state() private inputText = "Elen síla lúmenn' omentielvo";
  @state() private selectedMode = "quenya-tengwar-classical";
  @state() private selectedCharset = "tengwar_guni_annatar";
  @state() private outputText = "";
  @state() private copied = false;
  private currentRequestId = 0;

  static styles = [
    tengwarStyles,
    css`
    :host {
      display: block;
      margin-top: 1.5rem;
    }

    .container {
      background-color: var(--eldamo-surface);
      border: 1px solid var(--eldamo-surface-border);
      border-radius: 8px;
      padding: 1.5rem;
    }

    .title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .title {
      font-family: var(--eldamo-font-serif);
      font-size: 1.5rem;
      color: var(--eldamo-gold-bright);
      margin: 0;
    }

    .controls-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }

    .preset-chips {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      margin-bottom: 1rem;
      align-items: center;
    }

    .preset-label {
      font-size: 0.85rem;
      color: var(--eldamo-text-secondary);
      margin-right: 0.25rem;
    }

    .output-box {
      background-color: var(--eldamo-bg);
      border: 1px solid var(--eldamo-gold-muted);
      border-radius: 8px;
      padding: 1.5rem;
      min-height: 100px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      margin-top: 1rem;
      position: relative;
    }

    .tengwar-rendered {
      font-size: 2.4rem;
      line-height: 1.4;
      color: var(--eldamo-gold-bright);
      word-break: break-all;
    }

    .raw-code {
      font-family: monospace;
      font-size: 0.8rem;
      color: var(--eldamo-text-secondary);
      margin-top: 0.75rem;
      opacity: 0.8;
    }

    .copy-btn {
      position: absolute;
      top: 0.75rem;
      right: 0.75rem;
    }
  `,
  ];

  connectedCallback() {
    super.connectedCallback();
    this.updateTranscription();
  }

  private async updateTranscription() {
    const reqId = ++this.currentRequestId;
    try {
      const res = await transcribe(this.inputText, this.selectedMode, this.selectedCharset);
      if (this.currentRequestId === reqId) {
        this.outputText = res;
      }
    } catch (err) {
      console.error("Transcription error:", err);
      if (this.currentRequestId === reqId) {
        this.outputText = "";
      }
    }
  }

  private handleInput(e: Event) {
    const target = e.target as HTMLInputElement;
    this.inputText = target.value;
    this.updateTranscription();
  }

  private handleModeChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    this.selectedMode = target.value;
    this.updateTranscription();
  }

  private handleCharsetChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    this.selectedCharset = target.value;
    this.updateTranscription();
  }

  private setPreset(text: string, mode: string) {
    this.inputText = text;
    this.selectedMode = mode;
    this.updateTranscription();
  }

  private handleCopy() {
    if (!this.outputText) return;
    navigator.clipboard.writeText(this.outputText);
    this.copied = true;
    setTimeout(() => {
      this.copied = false;
    }, 2000);
  }

  render() {
    return html`
      <div class="container">
        <div class="title-row">
          <h2 class="title">Tengwar Transliterator</h2>
          <sl-badge variant="neutral">Glaemscribe Engine</sl-badge>
        </div>

        <div class="controls-grid">
          <div>
            <sl-select label="Transcription Mode" .value=${this.selectedMode} @sl-change=${this.handleModeChange}>
              ${MODES.map((m) => html`<sl-option value=${m.id}>${m.name}</sl-option>`)}
            </sl-select>
          </div>
          <div>
            <sl-select label="Font / Encoding" .value=${this.selectedCharset} @sl-change=${this.handleCharsetChange}>
              ${CHARSETS.map((c) => html`<sl-option value=${c.id}>${c.name}</sl-option>`)}
            </sl-select>
          </div>
        </div>

        <div class="preset-chips">
          <span class="preset-label">Sample Presets:</span>
          <sl-button size="small" variant="neutral" @click=${() => this.setPreset("Elen síla lúmenn' omentielvo", "quenya-tengwar-classical")}>
            Quenya: Elen síla...
          </sl-button>
          <sl-button size="small" variant="neutral" @click=${() => this.setPreset("A Elbereth Gilthoniel", "sindarin-tengwar-general_use")}>
            Sindarin: A Elbereth...
          </sl-button>
          <sl-button size="small" variant="neutral" @click=${() => this.setPreset("Ash nazg durbatulûk", "blackspeech-tengwar-general_use")}>
            Black Speech: Ash nazg...
          </sl-button>
          <sl-button size="small" variant="neutral" @click=${() => this.setPreset("The Lord of the Rings", "english-tengwar-espeak")}>
            English: Lord of the Rings
          </sl-button>
        </div>

        <sl-textarea
          label="Input Text (Latin Transliteration)"
          .value=${this.inputText}
          @sl-input=${this.handleInput}
          rows="2"
          resize="none"
        ></sl-textarea>

        <div class="output-box">
          <sl-button
            class="copy-btn"
            size="small"
            variant="default"
            @click=${this.handleCopy}
            ?disabled=${!this.outputText}
          >
            <sl-icon name=${this.copied ? "check" : "copy"} slot="prefix"></sl-icon>
            ${this.copied ? "Copied" : "Copy Output"}
          </sl-button>

          <div class="tengwar-rendered tengwar-text">
            ${this.outputText || html`<em style="font-size: 1rem; color: var(--eldamo-text-secondary);">(Enter text to transcribe)</em>`}
          </div>

          ${this.outputText ? html`<div class="raw-code">Raw Font Sequence: ${this.outputText}</div>` : ""}
        </div>
      </div>
    `;
  }
}
