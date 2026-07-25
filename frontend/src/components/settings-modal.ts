import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { saveApiKey, loadApiKey, invokeApi } from "../api";

@customElement("eldamo-settings-modal")
export class EldamoSettingsModal extends LitElement {
  @property({ type: Boolean }) open = false;
  @property({ type: String }) dbStatus = "dist/eldamo.db loaded (35,900 entries)";
  @property({ type: Boolean }) inProgress = false;
  @property({ type: Number }) progressPercent = 0;
  @property({ type: String }) statusText = "";

  @state() private currentKey = "";
  @state() private buildType: "fts" | "gemini" = "fts";

  static styles = css`
    .setting-section {
      margin-bottom: 1.5rem;
    }

    .setting-title {
      font-weight: 600;
      color: var(--eldamo-gold);
      margin-bottom: 0.5rem;
    }

    .db-status {
      font-family: monospace;
      font-size: 0.85rem;
      background: var(--eldamo-bg);
      padding: 0.5rem 0.75rem;
      border-radius: 4px;
      border: 1px solid var(--eldamo-surface-border);
      margin-bottom: 0.75rem;
    }

    .actions {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .action-row {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      flex-wrap: wrap;
    }

    .build-options {
      background: var(--eldamo-bg);
      padding: 0.75rem 1rem;
      border-radius: 6px;
      border: 1px solid var(--eldamo-surface-border);
      margin-top: 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .progress-box {
      margin-top: 1rem;
      background-color: var(--eldamo-bg);
      padding: 0.75rem;
      border-radius: 6px;
      border: 1px solid var(--eldamo-primary);
    }

    .progress-text {
      font-size: 0.8rem;
      color: var(--eldamo-text-secondary);
      margin-top: 0.5rem;
    }
  `;

  async connectedCallback() {
    super.connectedCallback();
    this.currentKey = await loadApiKey();
  }

  private handleKeyInput(e: CustomEvent) {
    const target = e.target as HTMLInputElement;
    this.currentKey = target.value;
  }

  private handleBuildTypeChange(e: Event) {
    const target = e.target as HTMLInputElement;
    this.buildType = target.value as "fts" | "gemini";
  }

  private async handleDownloadPrebuilt() {
    this.inProgress = true;
    this.statusText = "Initiating pre-built database download...";
    this.progressPercent = 0;
    try {
      await invokeApi("start_download_db");
    } catch (e) {
      console.error("Download error:", e);
      this.statusText = `Download failed: ${e}`;
      this.inProgress = false;
    }
  }

  private async handleRebuildXML() {
    this.inProgress = true;
    this.statusText = "Starting XML parse & database build...";
    this.progressPercent = 5;
    try {
      await invokeApi("start_build_local_db", { generate_vectors: this.buildType === "gemini" });
    } catch (e) {
      console.error("Rebuild error:", e);
      this.statusText = `Build failed: ${e}`;
      this.inProgress = false;
    }
  }

  private handleSave() {
    saveApiKey(this.currentKey);
    this.open = false;
    this.dispatchEvent(new CustomEvent("modal-closed", { bubbles: true, composed: true }));
  }

  private handleClose() {
    if (!this.inProgress) {
      this.open = false;
      this.dispatchEvent(new CustomEvent("modal-closed", { bubbles: true, composed: true }));
    }
  }

  render() {
    return html`
      <sl-dialog
        label="Eldamo Settings & Database Management"
        .open=${this.open}
        @sl-request-close=${this.handleClose}
        @sl-after-hide=${this.handleClose}
      >
        <div class="setting-section">
          <div class="setting-title">Active Database Status</div>
          <div class="db-status">${this.dbStatus}</div>

          <div class="actions">
            <div class="action-row">
              <sl-button variant="primary" size="small" ?disabled=${this.inProgress} @click=${this.handleDownloadPrebuilt}>
                <sl-icon name="cloud-download" slot="prefix"></sl-icon>
                Download Pre-built DB (~150MB, 768-dim Vectors)
              </sl-button>
            </div>

            <div class="build-options">
              <div style="font-size: 0.85rem; font-weight: 600;">Build Database from Local XML (data/eldamo-data.xml)</div>
              
              <sl-radio-group value=${this.buildType} @sl-change=${this.handleBuildTypeChange}>
                <sl-radio value="fts">⚡ FTS5 Exact Full-Text Index (~48MB, ~1 sec build, offline)</sl-radio>
                <sl-radio value="gemini">🧠 Gemini Embedding 2 Vectors (768-dim, requires API Key)</sl-radio>
              </sl-radio-group>

              <sl-button variant="default" size="small" ?disabled=${this.inProgress} @click=${this.handleRebuildXML}>
                <sl-icon name="gear" slot="prefix"></sl-icon>
                Build Database from XML
              </sl-button>
            </div>
          </div>

          ${this.inProgress
            ? html`
                <div class="progress-box">
                  <sl-progress-bar value=${this.progressPercent}></sl-progress-bar>
                  <div class="progress-text">${this.statusText}</div>
                </div>
              `
            : ""}
        </div>

        <div class="setting-section">
          <div class="setting-title">Gemini API Key (Query-Time Vector Search)</div>
          <sl-input
            type="password"
            placeholder="Enter Gemini API key..."
            value=${this.currentKey}
            password-toggle
            @sl-input=${this.handleKeyInput}
          ></sl-input>
          <div style="font-size: 0.8rem; color: var(--eldamo-text-secondary); margin-top: 0.35rem;">
            Your API key is saved locally across application restarts.
          </div>
        </div>

        <sl-button slot="footer" variant="primary" ?disabled=${this.inProgress} @click=${this.handleSave}>
          Save & Close
        </sl-button>
      </sl-dialog>
    `;
  }
}
