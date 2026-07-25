import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { invokeApi, loadApiKey, saveApiKey } from "../api";
import { getThemePreference, setThemePreference, ThemePreference } from "../services/theme";

@customElement("eldamo-settings-view")
export class EldamoSettingsView extends LitElement {
  @property({ type: String }) dbStatus = "Checking database status...";
  @property({ type: Boolean }) inProgress = false;
  @property({ type: Number }) progressPercent = 0;
  @property({ type: String }) statusText = "";

  @state() private activeTab: "appearance" | "database" | "apikey" = "appearance";
  @state() private themePref: ThemePreference = "auto";
  @state() private apiKey = "";
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
  }

  private handleThemeChange(pref: ThemePreference) {
    this.themePref = pref;
    setThemePreference(pref);
  }

  private handleSaveApiKey() {
    saveApiKey(this.apiKey);
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
            <span>Gemini API Key</span>
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

                  ${this.inProgress
                    ? html`
                        <div style="margin-top: 1rem;">
                          <div style="font-size: 0.85rem; margin-bottom: 0.5rem; color: var(--eldamo-gold-bright);">
                            ${this.statusText || "Processing..."}
                          </div>
                          <sl-progress-bar value=${this.progressPercent}></sl-progress-bar>
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
                  <h3 class="card-title">Gemini API Key</h3>
                  <div class="card-desc">
                    Required for generating 768-dimensional semantic embeddings for Elvish concept vector search and the Lexicon Assistant.
                  </div>

                  <div class="form-row">
                    <sl-input
                      type="password"
                      placeholder="AIzaSy..."
                      .value=${this.apiKey}
                      @sl-input=${(e: Event) => (this.apiKey = (e.target as HTMLInputElement).value)}
                      password-toggle
                    ></sl-input>

                    <div class="btn-group">
                      <sl-button variant="primary" @click=${this.handleSaveApiKey}>
                        <sl-icon name="check-lg" slot="prefix"></sl-icon> Save API Key
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
