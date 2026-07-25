import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

@customElement("eldamo-welcome-modal")
export class WelcomeModal extends LitElement {
  @property({ type: Boolean }) open = false;
  @property({ type: Boolean }) dbExists = false;
  @property({ type: String }) dbPath = "";
  @property({ type: Number }) wordCount = 0;

  @state() private dontShowAgain = false;

  static styles = css`
    :host {
      display: block;
    }

    .welcome-container {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .header-banner {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--eldamo-surface-border);
    }

    .logo-badge {
      width: 60px;
      height: 60px;
      border-radius: 14px;
      background: linear-gradient(135deg, var(--eldamo-primary), var(--eldamo-accent));
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 800;
      font-size: 2rem;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
    }

    .title {
      font-family: var(--eldamo-font-serif);
      font-size: 1.6rem;
      color: var(--eldamo-gold-bright);
      margin: 0;
    }

    .subtitle {
      font-size: 0.9rem;
      color: var(--eldamo-text-secondary);
      margin-top: 0.2rem;
    }

    .description {
      font-size: 0.95rem;
      color: var(--eldamo-text);
      line-height: 1.5;
    }

    .status-card {
      background-color: var(--eldamo-bg);
      border: 1px solid var(--eldamo-surface-border);
      border-radius: 8px;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .status-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.3rem 0.75rem;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 600;
    }

    .status-badge.ready {
      background-color: rgba(34, 197, 94, 0.15);
      color: #4ade80;
      border: 1px solid rgba(34, 197, 94, 0.3);
    }

    .status-badge.missing {
      background-color: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .action-banner {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      background-color: var(--eldamo-surface);
      border-radius: 8px;
      padding: 0.75rem 1rem;
      border-left: 4px solid var(--eldamo-primary);
    }

    .opt-out {
      margin-top: 0.5rem;
      font-size: 0.85rem;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.dontShowAgain = localStorage.getItem("eldamo_hide_welcome") === "true";
  }

  private handleOptOutChange(e: Event) {
    const target = e.target as HTMLInputElement;
    this.dontShowAgain = target.checked;
    if (this.dontShowAgain) {
      localStorage.setItem("eldamo_hide_welcome", "true");
    } else {
      localStorage.removeItem("eldamo_hide_welcome");
    }
  }

  private handleOpenDownloader() {
    this.handleClose();
    this.dispatchEvent(new CustomEvent("open-downloader", { bubbles: true, composed: true }));
  }

  private handleClose() {
    this.open = false;
    this.dispatchEvent(new CustomEvent("modal-closed", { bubbles: true, composed: true }));
  }

  render() {
    return html`
      <sl-dialog label="Welcome to Eldamo" .open=${this.open} @sl-after-hide=${this.handleClose}>
        <div class="welcome-container">
          <div class="header-banner">
            <div class="logo-badge">E</div>
            <div>
              <h2 class="title">Eldamo Lexicon</h2>
              <div class="subtitle">Offline Tolkien Elvish Dictionary & Vector Search</div>
            </div>
          </div>

          <div class="description">
            Eldamo is a comprehensive lexicon for J.R.R. Tolkien's constructed languages (Quenya, Sindarin, Primitive Elvish, Adûnaic, and 44 other dialects). It features full-text keyword search and AI vector similarity search using Gemini Embedding 2.
          </div>

          <div class="status-card">
            <div class="status-row">
              <span style="font-size: 0.9rem; font-weight: 600;">Database Status:</span>
              ${this.dbExists
                ? html`
                    <span class="status-badge ready">
                      <sl-icon name="check-circle-fill"></sl-icon>
                      Ready (${this.wordCount.toLocaleString()} entries)
                    </span>
                  `
                : html`
                    <span class="status-badge missing">
                      <sl-icon name="exclamation-triangle-fill"></sl-icon>
                      Database Not Installed
                    </span>
                  `}
            </div>

            ${!this.dbExists
              ? html`
                  <div class="action-banner">
                    <span style="font-size: 0.85rem; color: var(--eldamo-text-secondary);">
                      To start searching the lexicon, download the pre-built 768-dim vector database (~150MB) or build locally from XML.
                    </span>
                    <sl-button variant="primary" size="small" @click=${this.handleOpenDownloader}>
                      <sl-icon name="cloud-download" slot="prefix"></sl-icon>
                      Download / Install Database
                    </sl-button>
                  </div>
                `
              : html`
                  <div style="font-size: 0.85rem; color: var(--eldamo-text-secondary);">
                    Database file active at <code>${this.dbPath || "dist/eldamo.db"}</code>.
                  </div>
                `}
          </div>

          <div class="opt-out">
            <sl-checkbox .checked=${this.dontShowAgain} @sl-change=${this.handleOptOutChange}>
              Don't show this welcome screen on startup
            </sl-checkbox>
          </div>
        </div>

        <sl-button slot="footer" variant="primary" @click=${this.handleClose}>
          Get Started
        </sl-button>
      </sl-dialog>
    `;
  }
}
