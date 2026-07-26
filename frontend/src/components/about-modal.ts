import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { invokeApi } from "../api";

@customElement("eldamo-about-modal")
export class AboutModal extends LitElement {
  @property({ type: Boolean }) open = false;
  @state() private version = "";

  async connectedCallback() {
    super.connectedCallback();
    try {
      this.version = await invokeApi<string>("get_app_version");
    } catch {
      this.version = "0.1.2";
    }
  }

  static styles = css`
    :host {
      display: block;
    }

    sl-dialog::part(panel) {
      background-color: var(--eldamo-surface);
      border: 1px solid var(--eldamo-surface-border);
      border-radius: 14px;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6);
      color: var(--eldamo-text-primary);
    }

    sl-dialog::part(header) {
      border-bottom: 1px solid var(--eldamo-surface-border);
    }

    sl-dialog::part(title) {
      color: var(--eldamo-gold-bright);
      font-family: var(--eldamo-font-serif);
      font-weight: 700;
      font-size: 1.3rem;
    }

    sl-dialog::part(footer) {
      border-top: 1px solid var(--eldamo-surface-border);
    }

    .about-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }

    .logo-container {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      background: linear-gradient(135deg, var(--eldamo-primary), var(--eldamo-accent));
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 700;
      font-size: 1.75rem;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .app-title {
      font-family: var(--eldamo-font-serif);
      font-size: 1.4rem;
      font-weight: 700;
      color: var(--eldamo-gold-bright);
      margin: 0;
    }

    .version-badge {
      font-size: 0.75rem;
      padding: 0.15rem 0.5rem;
      border-radius: 12px;
      background-color: var(--eldamo-surface-border);
      color: var(--eldamo-text-secondary);
      display: inline-block;
      margin-top: 0.2rem;
    }

    .section {
      margin-bottom: 1.25rem;
      font-size: 0.9rem;
      color: var(--eldamo-text-secondary);
      line-height: 1.5;
    }

    .section-title {
      font-weight: 600;
      color: var(--eldamo-text);
      margin-bottom: 0.4rem;
      font-size: 0.95rem;
    }

    .tech-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.5rem;
      margin-top: 0.5rem;
    }

    .tech-item {
      background-color: var(--eldamo-bg);
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
      border: 1px solid var(--eldamo-surface-border);
      font-size: 0.8rem;
    }

    .tech-item strong {
      color: var(--eldamo-text);
      display: block;
    }

    a {
      color: var(--eldamo-primary);
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }
  `;

  private handleHide() {
    this.dispatchEvent(new CustomEvent("modal-closed", { bubbles: true, composed: true }));
  }

  render() {
    return html`
      <sl-dialog .open=${this.open} label="About Eldamo" @sl-after-hide=${this.handleHide}>
        <div class="about-header">
          <div class="logo-container">E</div>
          <div>
            <h2 class="app-title">Eldamo Lexicon Viewer</h2>
            <span class="version-badge">Version ${this.version || "0.1.2"}</span>
          </div>
        </div>

        <div class="section">
          Cross-platform desktop dictionary and semantic vector search engine for J.R.R. Tolkien's constructed languages (Quenya, Sindarin, Primitive Elvish, Adûnaic, and 44 other dialects).
        </div>

        <div class="section">
          <div class="section-title">Data Credits</div>
          Eldamo language dataset compiled and maintained by <strong>Paul Strack</strong> at
          <a href="https://eldamo.org" target="_blank" rel="noopener">Eldamo.org</a>.
        </div>

        <div class="section">
          <div class="section-title">Technology Stack</div>
          <div class="tech-grid">
            <div class="tech-item">
              <strong>Go & Wails v2</strong>
              Native desktop container & IPC
            </div>
            <div class="tech-item">
              <strong>SQLite + sqlite-vec</strong>
              FTS5 BM25 & 768-dim vector index
            </div>
            <div class="tech-item">
              <strong>Lit Web Components</strong>
              Lightweight reactive UI
            </div>
            <div class="tech-item">
              <strong>Gemini Embedding 2</strong>
              Multilingual semantic embeddings
            </div>
            <div class="tech-item">
              <strong>Glaemscribe (AGPLv3)</strong>
              Benjamin Babut's Tengwar engine
            </div>
          </div>
        </div>

        <sl-button slot="footer" variant="primary" @click=${this.handleHide}>Close</sl-button>
      </sl-dialog>
    `;
  }
}
