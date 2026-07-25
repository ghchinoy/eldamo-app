import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { invokeApi } from "../api";

@customElement("eldamo-status-footer")
export class StatusFooter extends LitElement {
  @property({ type: Boolean }) dbExists = false;
  @property({ type: String }) dbPath = "";
  @property({ type: Number }) wordCount = 0;
  @property({ type: String }) embeddingModel = "";
  @property({ type: Boolean }) inProgress = false;
  @property({ type: Number }) progressPercent = 0;
  @property({ type: String }) statusText = "";
  @state() private version = "";

  async connectedCallback() {
    super.connectedCallback();
    try {
      this.version = await invokeApi<string>("get_app_version");
    } catch {
      this.version = "0.1.0";
    }
  }

  static styles = css`
    :host {
      display: block;
      margin-top: auto;
      background-color: var(--eldamo-surface);
      border-top: 1px solid var(--eldamo-surface-border);
      padding: 0.4rem 1.5rem;
      font-size: 0.8rem;
      color: var(--eldamo-text-secondary);
      box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
    }

    .footer-content {
      max-width: 1000px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .status-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }

    .dot.green {
      background-color: #22c55e;
      box-shadow: 0 0 6px #22c55e;
    }

    .dot.red {
      background-color: #ef4444;
      box-shadow: 0 0 6px #ef4444;
    }

    .dot.orange {
      background-color: #f59e0b;
      box-shadow: 0 0 6px #f59e0b;
      animation: pulse 1.2s infinite;
    }

    @keyframes pulse {
      0% { opacity: 0.4; }
      50% { opacity: 1; }
      100% { opacity: 0.4; }
    }

    .progress-bar-inline {
      flex: 1;
      max-width: 300px;
    }

    .action-link {
      color: var(--eldamo-primary);
      cursor: pointer;
      text-decoration: underline;
    }

    .action-link:hover {
      color: var(--eldamo-accent);
    }
  `;

  private handleOpenSettings() {
    this.dispatchEvent(new CustomEvent("open-settings", { bubbles: true, composed: true }));
  }

  render() {
    return html`
      <div class="footer-content">
        ${this.inProgress
          ? html`
              <div class="status-group" style="width: 100%;">
                <span class="dot orange"></span>
                <span style="font-weight: 600; color: var(--eldamo-gold);">${this.statusText || "Processing database..."}</span>
                <sl-progress-bar class="progress-bar-inline" value=${this.progressPercent}></sl-progress-bar>
              </div>
            `
          : html`
              <div class="status-group">
                ${this.dbExists
                  ? html`
                      <span class="dot green"></span>
                      <span>
                        <strong>Eldamo DB Active:</strong> ${this.wordCount.toLocaleString()} words
                        ${this.embeddingModel ? ` (${this.embeddingModel} 768-dim)` : " (FTS5)"}
                      </span>
                    `
                  : html`
                      <span class="dot red"></span>
                      <span>
                        <strong>No Database Loaded:</strong> Search is currently inactive.
                        <span class="action-link" @click=${this.handleOpenSettings}>Install Database</span>
                      </span>
                    `}
              </div>

              <div>
                Eldamo App v${this.version || "0.1.0"}
              </div>
            `}
      </div>
    `;
  }
}
