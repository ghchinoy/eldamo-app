import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { invokeApi, loadApiKey, saveApiKey, loadGeminiModel, saveGeminiModel } from "../api";
import { getThemePreference, setThemePreference, ThemePreference } from "../services/theme";

@customElement("eldamo-settings-view")
export class EldamoSettingsView extends LitElement {
  @property({ type: String }) dbStatus = "Checking database status...";
  @property({ type: Boolean }) inProgress = false;
  @property({ type: Number }) progressPercent = 0;
  @property({ type: String }) statusText = "";

  @property({ type: String }) activeTab: "appearance" | "database" | "apikey" = "appearance";
  @state() private themePref: ThemePreference = "auto";
  @state() private apiKey = "";
  @state() private geminiModel = "gemini-3.5-flash-lite";
  @state() private customModelText = "";
  @state() private dbOption: "fts" | "vectors" = "vectors";
  @state() private customDbUrl = "";
  @state() private savedNotice = false;

  static styles = css`
    :host {
      display: block;
      margin-top: 1rem;
    }

    .settings-shell {
      display: flex;
      min-height: 520px;
      background-color: var(--eldamo-surface);
      border: 1px solid var(--eldamo-surface-border);
      border-radius: 12px;
      overflow: hidden;
    }

    .sub-nav {
      width: 200px;
      background-color: var(--md-sys-color-surface-container-low, rgba(0, 0, 0, 0.2));
      border-right: 1px solid var(--eldamo-surface-border);
      padding: 1.25rem 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      shrink: 0;
    }

    .sub-nav-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.6rem 0.85rem;
      border-radius: 8px;
      font-size: 0.88rem;
      font-weight: 500;
      color: var(--eldamo-text-secondary);
      cursor: pointer;
      transition: background-color 0.15s ease, color 0.15s ease;
    }

    .sub-nav-item:hover {
      background-color: var(--md-sys-color-surface-container-high, rgba(255, 255, 255, 0.05));
      color: var(--eldamo-text-primary);
    }

    .sub-nav-item.active {
      background-color: var(--md-sys-color-primary-container, rgba(176, 198, 255, 0.15));
      color: var(--eldamo-gold-bright);
      font-weight: 600;
    }

    .content-area {
      flex: 1;
      padding: 2rem;
      overflow-y: auto;
    }

    .card {
      background-color: var(--eldamo-bg);
      border: 1px solid var(--eldamo-surface-border);
      border-radius: 10px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .card-title {
      font-family: var(--eldamo-font-serif);
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--eldamo-gold-bright);
      margin: 0 0 0.5rem 0;
    }

    .card-desc {
      font-size: 0.88rem;
      color: var(--eldamo-text-secondary);
      line-height: 1.5;
      margin-bottom: 1.25rem;
    }

    .form-row {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .btn-group {
      display: flex;
      gap: 0.75rem;
      align-items: center;
    }
  `;

  async connectedCallback() {
    super.connectedCallback();
    this.themePref = getThemePreference();
    this.apiKey = await loadApiKey();
    const savedModel = await loadGeminiModel();
    if (savedModel === "gemini-3.5-flash-lite" || savedModel === "gemini-3.6-flash") {
      this.geminiModel = savedModel;
    } else if (savedModel) {
      this.geminiModel = "custom";
      this.customModelText = savedModel;
    } else {
      this.geminiModel = "gemini-3.5-flash-lite";
    }
  }

  private handleThemeChange(pref: ThemePreference) {
    this.themePref = pref;
    setThemePreference(pref);
  }

  private handleSaveAIConfig() {
    saveApiKey(this.apiKey);
    const targetModel = this.geminiModel === "custom" ? this.customModelText.trim() : this.geminiModel;
    saveGeminiModel(targetModel || "gemini-3.5-flash-lite");
    this.savedNotice = true;
    setTimeout(() => {
      this.savedNotice = false;
    }, 2500);
  }

  private handleDownloadDb() {
    const url = this.customDbUrl.trim() ? this.customDbUrl.trim() : null;
    invokeApi("start_download_db", { url }).catch((err) => console.error("Download DB error:", err));
  }

  private handleBuildDb() {
    const generate_vectors = this.dbOption === "vectors";
    invokeApi("start_build_local_db", { generate_vectors }).catch((err) => console.error("Build DB error:", err));
  }

  render() {
    return html`
      <div class="settings-shell">
        <div class="sub-nav">
          <div
            class="sub-nav-item ${this.activeTab === "appearance" ? "active" : ""}"
            @click=${() => (this.activeTab = "appearance")}
          >
            <sl-icon name="palette"></sl-icon>
            <span>Appearance</span>
          </div>

          <div
            class="sub-nav-item ${this.activeTab === "database" ? "active" : ""}"
            @click=${() => (this.activeTab = "database")}
          >
            <sl-icon name="database"></sl-icon>
            <span>Database</span>
          </div>

          <div
            class="sub-nav-item ${this.activeTab === "apikey" ? "active" : ""}"
            @click=${() => (this.activeTab = "apikey")}
          >
            <sl-icon name="key"></sl-icon>
            <span>Gemini AI</span>
          </div>
        </div>

        <div class="content-area">
          ${this.activeTab === "appearance"
            ? html`
                <div class="card">
                  <h3 class="card-title">Theme Preference</h3>
                  <div class="card-desc">
                    Choose the visual theme for Eldamo. Neutral Material 3 palette adapts seamlessly between light and dark modes.
                  </div>

                  <div class="btn-group">
                    <sl-button
                      variant=${this.themePref === "auto" ? "primary" : "default"}
                      @click=${() => this.handleThemeChange("auto")}
                    >
                      <sl-icon name="display" slot="prefix"></sl-icon> System Auto
                    </sl-button>
                    <sl-button
                      variant=${this.themePref === "light" ? "primary" : "default"}
                      @click=${() => this.handleThemeChange("light")}
                    >
                      <sl-icon name="sun" slot="prefix"></sl-icon> Light
                    </sl-button>
                    <sl-button
                      variant=${this.themePref === "dark" ? "primary" : "default"}
                      @click=${() => this.handleThemeChange("dark")}
                    >
                      <sl-icon name="moon" slot="prefix"></sl-icon> Dark
                    </sl-button>
                  </div>
                </div>
              `
            : ""}

          ${this.activeTab === "database"
            ? html`
                <div class="card">
                  <h3 class="card-title">Active Database Status</h3>
                  <div class="card-desc">${this.dbStatus}</div>

                  ${this.inProgress || this.statusText
                    ? html`
                        <div style="margin-top: 1rem;">
                          <div style="font-size: 0.88rem; margin-bottom: 0.5rem; color: var(--eldamo-gold-bright); font-weight: 500;">
                            ${this.statusText || "Processing..."}
                          </div>
                          ${this.inProgress
                            ? html`<sl-progress-bar value=${this.progressPercent}></sl-progress-bar>`
                            : ""}
                        </div>
                      `
                    : ""}
                </div>

                <div class="card">
                  <h3 class="card-title">Download Prebuilt Database</h3>
                  <div class="card-desc">
                    Download precompiled SQLite database containing FTS5 BM25 search indices and prebuilt 768-dim vector embeddings.
                  </div>

                  <div class="form-row">
                    <sl-input
                      placeholder="Custom Release Download URL (Optional)"
                      .value=${this.customDbUrl}
                      @sl-input=${(e: Event) => (this.customDbUrl = (e.target as HTMLInputElement).value)}
                    ></sl-input>
                    <sl-button variant="primary" ?disabled=${this.inProgress} @click=${this.handleDownloadDb}>
                      <sl-icon name="download" slot="prefix"></sl-icon> Start Download
                    </sl-button>
                  </div>
                </div>

                <div class="card">
                  <h3 class="card-title">Rebuild Database From Source XML</h3>
                  <div class="card-desc">
                    Build a fresh database locally from upstream <code>eldamo-data.xml</code>.
                  </div>

                  <div class="form-row">
                    <sl-radio-group
                      value=${this.dbOption}
                      @sl-change=${(e: Event) => (this.dbOption = (e.target as HTMLInputElement).value as "fts" | "vectors")}
                    >
                      <sl-radio value="vectors">FTS5 + Gemini Vector Embeddings (Recommended)</sl-radio>
                      <sl-radio value="fts">FTS5 Keyword Search Only (Faster)</sl-radio>
                    </sl-radio-group>

                    <sl-button variant="default" ?disabled=${this.inProgress} @click=${this.handleBuildDb}>
                      <sl-icon name="hammer" slot="prefix"></sl-icon> Build Local DB
                    </sl-button>
                  </div>
                </div>
              `
            : ""}

          ${this.activeTab === "apikey"
            ? html`
                <div class="card">
                  <h3 class="card-title">Gemini API Key & Model Configuration</h3>
                  <div class="card-desc">
                    Configure your Gemini API key and model preferences for vector search and the RAG Lexicon Assistant. An API key is optional — if omitted or if a model error occurs, search results are shown as a fallback.
                  </div>

                  <div class="form-row">
                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--eldamo-text-primary);">Gemini API Key</label>
                    <sl-input
                      type="password"
                      placeholder="AIzaSy..."
                      .value=${this.apiKey}
                      @sl-input=${(e: Event) => (this.apiKey = (e.target as HTMLInputElement).value)}
                      password-toggle
                    ></sl-input>

                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--eldamo-text-primary); margin-top: 0.5rem;">Lexicon Assistant Model</label>
                    <sl-select
                      .value=${this.geminiModel}
                      @sl-change=${(e: Event) => (this.geminiModel = (e.target as HTMLInputElement).value)}
                    >
                      <sl-option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite (Fast & low-cost — Recommended)</sl-option>
                      <sl-option value="gemini-3.6-flash">gemini-3.6-flash (Higher quality)</sl-option>
                      <sl-option value="custom">Custom model ID...</sl-option>
                    </sl-select>

                    ${this.geminiModel === "custom"
                      ? html`
                          <sl-input
                            placeholder="e.g. gemini-3.1-flash-lite-preview"
                            .value=${this.customModelText}
                            @sl-input=${(e: Event) => (this.customModelText = (e.target as HTMLInputElement).value)}
                          ></sl-input>
                        `
                      : ""}

                    <div class="btn-group" style="margin-top: 0.5rem;">
                      <sl-button variant="primary" @click=${this.handleSaveAIConfig}>
                        <sl-icon name="check-lg" slot="prefix"></sl-icon> Save Settings
                      </sl-button>
                      ${this.savedNotice ? html`<sl-badge variant="success">Saved!</sl-badge>` : ""}
                    </div>
                  </div>
                </div>
              `
            : ""}
        </div>
      </div>
    `;
  }
}
