import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { invokeApi, onDBProgress, onAppNotification, onOpenAbout, onOpenConfig, BrowseResult, DBInfo, ProgressEvent, NotificationEvent, CategoryGroup, SourceMeta } from "../api";
import "./header";
import "./sidebar";
import "./right-rail";
import { addRecentEntry, EldamoSidebar } from "./sidebar";
import "./search-bar";
import "./browse-bar";
import "./domain-bar";
import "./concordance-bar";
import "./transliterator-bar";
import "./chat-bar";
import "./settings-view";
import "./result-card";
import "./entry-detail-modal";
import "./settings-modal";
import "./about-modal";
import "./welcome-modal";
import "./status-footer";
import { SearchResult, WordEntry } from "./result-card";
import { FullEntryDetail } from "./entry-detail-modal";

@customElement("eldamo-app")
export class EldamoApp extends LitElement {
  @state() private viewMode: "search" | "browse" | "domain" | "concordance" | "transliterator" | "chat" | "settings" = "search";
  @state() private sidebarCollapsed = false;

  // Search state
  @state() private searchResults: SearchResult[] = [];
  @state() private currentQuery = "star";
  @state() private searchLang = "";
  @state() private searchMode: "fts" | "vector" = "fts";
  @state() private minSimilarity = 0.65;

  // Browse state
  @state() private browseEntries: WordEntry[] = [];
  @state() private browseTotal = 0;
  @state() private browsePage = 1;
  @state() private browseLetter = "ALL";
  @state() private browseLang = "";

  // Domain state
  @state() private categoryGroups: CategoryGroup[] = [];
  @state() private selectedGroupID = "";
  @state() private selectedCategoryID = "";
  @state() private domainEntries: WordEntry[] = [];

  // Concordance state
  @state() private sourcesList: SourceMeta[] = [];
  @state() private concordanceEntries: WordEntry[] = [];

  // Common & DB state
  @state() private languages: Array<{ id: string; name: string }> = [];
  @state() private selectedDetail: FullEntryDetail | null = null;
  @state() private railOpen = false;
  @state() private detailLoading = false;
  @state() private aboutOpen = false;
  @state() private welcomeOpen = false;
  @state() private loading = false;
  @state() private dbMissing = false;

  // Live DB progress state
  @state() private dbInfo: DBInfo = {
    exists: false,
    path: "",
    word_count: 0,
    language_count: 0,
    embedding_model: "",
    size_bytes: 0,
  };
  @state() private inProgress = false;
  @state() private progressPercent = 0;
  @state() private progressStatusText = "";

  private unbindProgress: (() => void) | null = null;
  private unbindNotification: (() => void) | null = null;
  private unbindOpenAbout: (() => void) | null = null;
  private unbindOpenConfig: (() => void) | null = null;
  private handleGlobalKeyDown: ((e: KeyboardEvent) => void) | null = null;

  static styles = css`
    :host {
      display: block;
      height: 100vh;
      overflow: hidden;
    }

    .app-grid {
      display: grid;
      grid-template-columns: 264px 1fr auto;
      height: 100vh;
      overflow: hidden;
      position: relative;
    }

    .app-grid.sidebar-collapsed {
      grid-template-columns: 1fr auto;
    }

    .sidebar-column {
      height: 100%;
      overflow: hidden;
      z-index: 50;
    }

    .app-grid.sidebar-collapsed .sidebar-column {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 264px;
      transform: translateX(-100%);
      transition: transform 0.18s ease;
      pointer-events: none;
      visibility: hidden;
    }

    .main-column {
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }

    .main-scroll {
      flex: 1;
      overflow-y: auto;
      max-width: 1000px;
      width: 100%;
      margin: 0 auto;
      padding: 1.5rem 1.5rem 4rem 1.5rem;
      box-sizing: border-box;
    }

    .sticky-top {
      position: sticky;
      top: 0;
      z-index: 40;
      background-color: var(--eldamo-bg);
      padding-top: 0.5rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--eldamo-surface-border);
      margin-bottom: 1.5rem;
    }

    .db-alert {
      margin-bottom: 1.5rem;
    }

    .results-grid {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .no-results {
      text-align: center;
      padding: 3rem;
      color: var(--eldamo-text-secondary);
      background-color: var(--eldamo-surface);
      border-radius: 8px;
      border: 1px solid var(--eldamo-surface-border);
    }
  `;

  async firstUpdated() {
    // Show welcome modal if not explicitly hidden
    if (localStorage.getItem("eldamo_hide_welcome") !== "true") {
      this.welcomeOpen = true;
    }

    await this.fetchDBInfo();
    await this.loadLanguages();
    await this.loadCategories();
    await this.loadSources();

    if (this.dbInfo.exists) {
      this.executeSearch(this.currentQuery, "", "fts");
    }

    // Subscribe to Wails backend streaming progress events
    this.unbindProgress = onDBProgress((evt: ProgressEvent) => {
      this.inProgress = !evt.completed && evt.stage !== "error";
      this.progressPercent = evt.percent;
      this.progressStatusText = evt.status_text;

      if (evt.completed) {
        this.fetchDBInfo();
        this.loadLanguages();
        this.executeSearch(this.currentQuery, "", "fts");
      }
    });

    // Subscribe to Wails backend notification events
    this.unbindNotification = onAppNotification((evt: NotificationEvent) => {
      this.showToast(evt.level, evt.message);
    });

    // Subscribe to menu trigger events
    this.unbindOpenAbout = onOpenAbout(() => {
      this.aboutOpen = true;
    });

    this.unbindOpenConfig = onOpenConfig(() => {
      this.viewMode = "settings";
    });

    this.handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        this.handleToggleSidebar();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        this.viewMode = "settings";
      }
    };
    window.addEventListener("keydown", this.handleGlobalKeyDown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.unbindProgress) {
      this.unbindProgress();
    }
    if (this.unbindNotification) {
      this.unbindNotification();
    }
    if (this.unbindOpenAbout) {
      this.unbindOpenAbout();
    }
    if (this.unbindOpenConfig) {
      this.unbindOpenConfig();
    }
    if (this.handleGlobalKeyDown) {
      window.removeEventListener("keydown", this.handleGlobalKeyDown);
    }
  }

  private showToast(level: string, message: string) {
    const alert = Object.assign(document.createElement("sl-alert"), {
      variant: level === "error" ? "danger" : level === "warning" ? "warning" : "primary",
      closable: true,
      duration: 4500,
      innerHTML: `<sl-icon name="${level === "error" ? "exclamation-octagon" : "exclamation-triangle"}" slot="icon"></sl-icon>${message}`,
    });
    document.body.append(alert);
    (alert as any).toast();
  }

  private async fetchDBInfo() {
    try {
      this.dbInfo = await invokeApi<DBInfo>("get_db_info");
      this.dbMissing = !this.dbInfo.exists;
    } catch (e) {
      console.warn("Error fetching DB info:", e);
      this.dbMissing = true;
    }
  }

  private async loadLanguages() {
    try {
      this.languages = await invokeApi("get_languages");
      this.dbMissing = false;
    } catch (e: unknown) {
      console.warn("Language loading error:", e);
      if (typeof e === "string" && e.includes("Database not loaded")) {
        this.dbMissing = true;
      }
    }
  }

  private async loadCategories() {
    try {
      this.categoryGroups = await invokeApi<CategoryGroup[]>("get_category_tree");
      if (this.categoryGroups.length > 0) {
        this.selectedGroupID = this.categoryGroups[0].group_id;
        if (this.categoryGroups[0].categories.length > 0) {
          this.selectedCategoryID = this.categoryGroups[0].categories[0].id;
        }
      }
    } catch (e) {
      console.warn("Error loading category tree:", e);
    }
  }

  private async loadSources() {
    try {
      this.sourcesList = await invokeApi<SourceMeta[]>("get_sources_list");
    } catch (e) {
      console.warn("Error loading sources list:", e);
    }
  }

  private handleModeChange(e: CustomEvent<{ mode: "search" | "browse" | "domain" | "concordance" }>) {
    const mode = e.detail.mode;
    this.viewMode = mode;
    if (mode === "browse" && this.browseEntries.length === 0) {
      this.executeBrowse(this.browseLetter, this.browseLang, 1);
    } else if (mode === "domain" && this.domainEntries.length === 0 && this.selectedCategoryID) {
      this.executeDomainBrowse(this.selectedCategoryID);
    } else if (mode === "concordance" && this.concordanceEntries.length === 0) {
      this.executeConcordance("root", "KAL");
    }
  }

  private handleConcordanceChange(e: CustomEvent) {
    const { mode, query } = e.detail;
    if (query) {
      this.executeConcordance(mode, query);
    }
  }

  private async executeConcordance(mode: "root" | "source", query: string) {
    this.loading = true;
    this.concordanceEntries = [];
    try {
      if (mode === "root") {
        const res: BrowseResult = await invokeApi("get_concordance", { root: query, page: 1, page_size: 50 });
        this.concordanceEntries = res.entries;
      } else {
        const res: BrowseResult = await invokeApi("get_attestations_by_source", { source: query, page: 1, page_size: 50 });
        this.concordanceEntries = res.entries;
      }
    } catch (e) {
      console.error("Concordance query error:", e);
    } finally {
      this.loading = false;
    }
  }

  private handleDomainChange(e: CustomEvent) {
    const { category_id, group_id } = e.detail;
    this.selectedCategoryID = category_id;
    this.selectedGroupID = group_id;
    if (category_id) {
      this.executeDomainBrowse(category_id);
    }
  }

  private async executeDomainBrowse(catID: string) {
    this.loading = true;
    this.domainEntries = [];
    try {
      const res: BrowseResult = await invokeApi("browse_by_category", { cat_id: catID, page: 1, page_size: 50 });
      this.domainEntries = res.entries;
    } catch (e) {
      console.error("Domain browse error:", e);
    } finally {
      this.loading = false;
    }
  }

  private async handleSearchChange(e: CustomEvent) {
    const { query, lang, mode, minSimilarity } = e.detail;
    this.currentQuery = query;
    this.searchLang = lang;
    this.searchMode = mode;
    if (minSimilarity !== undefined) {
      this.minSimilarity = minSimilarity;
    }
    this.executeSearch(query, lang, mode);
  }

  private async executeSearch(query: string, lang: string, mode: "fts" | "vector") {
    if (!query.trim()) {
      this.searchResults = [];
      return;
    }

    this.loading = true;
    this.searchResults = [];
    try {
      if (mode === "fts") {
        this.searchResults = await invokeApi("search_fts", {
          query: query,
          lang: lang || null,
          speech: null,
          limit: 30,
        });
      } else {
        const rawResults: SearchResult[] = await invokeApi("search_vector_query", {
          query: query,
          limit: 50,
        });
        // Filter vector search results by similarity threshold
        this.searchResults = rawResults.filter((r) => r.score >= this.minSimilarity);
      }
      this.dbMissing = false;
    } catch (e: unknown) {
      console.error("Search error:", e);
      this.searchResults = [];
      if (typeof e === "string" && e.includes("Database not loaded")) {
        this.dbMissing = true;
      }
    } finally {
      this.loading = false;
    }
  }

  private async handleBrowseChange(e: CustomEvent) {
    const { letter, lang, page } = e.detail;
    this.browseLetter = letter;
    this.browseLang = lang;
    this.browsePage = page;
    this.executeBrowse(letter, lang, page);
  }

  private async executeBrowse(letter: string, lang: string, page: number) {
    this.loading = true;
    try {
      const res: BrowseResult = await invokeApi("browse_words", {
        letter: letter === "ALL" ? null : letter,
        lang: lang || null,
        page,
        pageSize: 50,
      });
      this.browseEntries = res.entries;
      this.browseTotal = res.total_count;
      this.browsePage = res.page;
      this.dbMissing = false;
    } catch (e: unknown) {
      console.error("Browse error:", e);
      if (typeof e === "string" && e.includes("Database not loaded")) {
        this.dbMissing = true;
      }
    } finally {
      this.loading = false;
    }
  }

  private handleToggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  private async handleSelectEntry(e: CustomEvent) {
    const { page_id } = e.detail;
    this.detailLoading = true;
    this.railOpen = true;
    try {
      this.selectedDetail = await invokeApi("get_entry", { page_id });
      if (this.selectedDetail?.entry) {
        addRecentEntry(this.selectedDetail.entry);
        const sidebar = this.shadowRoot?.querySelector("eldamo-sidebar") as EldamoSidebar | null;
        if (sidebar) {
          sidebar.refreshHistory();
        }
      }
    } catch (err) {
      console.error("Error fetching entry detail:", err);
    } finally {
      this.detailLoading = false;
    }
  }

  render() {
    const viewTitleMap: Record<string, string> = {
      search: "Lexicon Search",
      browse: "Browse A-Z",
      domain: "Semantic Domains",
      concordance: "Source Concordance",
      transliterator: "Tengwar Transliterator",
      chat: "Lexicon Assistant",
      settings: "Settings",
    };

    return html`
      <div class="app-grid ${this.sidebarCollapsed ? "sidebar-collapsed" : ""}">
        <div class="sidebar-column">
          <eldamo-sidebar
            .viewMode=${this.viewMode}
            .collapsed=${this.sidebarCollapsed}
            @mode-change=${this.handleModeChange}
            @toggle-sidebar=${this.handleToggleSidebar}
            @open-settings=${() => (this.viewMode = "settings")}
            @open-about=${() => (this.aboutOpen = true)}
            @select-entry=${this.handleSelectEntry}
          ></eldamo-sidebar>
        </div>

        <div class="main-column">
          <eldamo-header
            .viewTitle=${viewTitleMap[this.viewMode] || "Eldamo"}
            .sidebarCollapsed=${this.sidebarCollapsed}
            @toggle-sidebar=${this.handleToggleSidebar}
          ></eldamo-header>

          <div class="main-scroll">
            <div class="sticky-top">
              ${this.viewMode === "search"
                ? html`
                    <eldamo-search-bar
                      .query=${this.currentQuery}
                      .searchLang=${this.searchLang}
                      .searchMode=${this.searchMode}
                      .minSimilarity=${this.minSimilarity}
                      .languages=${this.languages}
                      @search-change=${this.handleSearchChange}
                    ></eldamo-search-bar>
                  `
                : this.viewMode === "browse"
                ? html`
                    <eldamo-browse-bar
                      .selectedLetter=${this.browseLetter}
                      .selectedLanguage=${this.browseLang}
                      .currentPage=${this.browsePage}
                      .totalCount=${this.browseTotal}
                      .languages=${this.languages}
                      @browse-change=${this.handleBrowseChange}
                    ></eldamo-browse-bar>
                  `
                : this.viewMode === "domain"
                ? html`
                    <eldamo-domain-bar
                      .categoryGroups=${this.categoryGroups}
                      .selectedGroupID=${this.selectedGroupID}
                      .selectedCategoryID=${this.selectedCategoryID}
                      @domain-change=${this.handleDomainChange}
                    ></eldamo-domain-bar>
                  `
                : this.viewMode === "concordance"
                ? html`
                    <eldamo-concordance-bar
                      .sources=${this.sourcesList}
                      @concordance-change=${this.handleConcordanceChange}
                    ></eldamo-concordance-bar>
                  `
                : ""}
            </div>

      ${this.dbMissing
        ? html`
            <sl-alert variant="warning" open class="db-alert">
              <sl-icon slot="icon" name="exclamation-triangle"></sl-icon>
              <strong>Eldamo Database Not Found</strong><br />
              The application requires a database file to search entries. Click
              <sl-button variant="text" size="small" @click=${() => (this.viewMode = "settings")}>Settings & DB</sl-button>
              to download the pre-built vector database (~150MB) or build from local XML.
            </sl-alert>
          `
        : ""}

      <main>
        ${this.loading ? html`<sl-spinner style="font-size: 2rem; display: block; margin: 2rem auto;"></sl-spinner>` : ""}

        ${!this.loading && this.viewMode === "search" && this.searchResults.length > 0
          ? html`
              <div class="results-grid">
                ${this.searchResults.map(
                  (r) => html`
                    <eldamo-result-card
                      .result=${r}
                      .showScore=${this.searchMode === "vector"}
                      @select-entry=${this.handleSelectEntry}
                    ></eldamo-result-card>
                  `
                )}
              </div>
            `
          : ""}

        ${!this.loading && this.viewMode === "browse" && this.browseEntries.length > 0
          ? html`
              <div class="results-grid">
                ${this.browseEntries.map(
                  (entry) => html`
                    <eldamo-result-card
                      .result=${{ entry, score: 0 }}
                      .showScore=${false}
                      @select-entry=${this.handleSelectEntry}
                    ></eldamo-result-card>
                  `
                )}
              </div>
            `
          : ""}

        ${!this.loading && this.viewMode === "domain" && this.domainEntries.length > 0
          ? html`
              <div class="results-grid">
                ${this.domainEntries.map(
                  (entry) => html`
                    <eldamo-result-card
                      .result=${{ entry, score: 0 }}
                      .showScore=${false}
                      @select-entry=${this.handleSelectEntry}
                    ></eldamo-result-card>
                  `
                )}
              </div>
            `
          : ""}

        ${!this.loading && this.viewMode === "concordance" && this.concordanceEntries.length > 0
          ? html`
              <div class="results-grid">
                ${this.concordanceEntries.map(
                  (entry) => html`
                    <eldamo-result-card
                      .result=${{ entry, score: 0 }}
                      .showScore=${false}
                      @select-entry=${this.handleSelectEntry}
                    ></eldamo-result-card>
                  `
                )}
              </div>
            `
          : ""}

        ${this.viewMode === "transliterator"
          ? html`<eldamo-transliterator-bar></eldamo-transliterator-bar>`
          : ""}

        ${this.viewMode === "chat"
          ? html`<eldamo-chat-bar @select-entry=${this.handleSelectEntry}></eldamo-chat-bar>`
          : ""}

        ${this.viewMode === "settings"
          ? html`
              <eldamo-settings-view
                .dbStatus=${this.dbMissing
                  ? "No database loaded"
                  : `${this.dbInfo.path || "dist/eldamo.db"} loaded (${this.dbInfo.word_count.toLocaleString()} entries)`}
                .inProgress=${this.inProgress}
                .progressPercent=${this.progressPercent}
                .statusText=${this.progressStatusText}
              ></eldamo-settings-view>
            `
          : ""}

        ${!this.loading &&
        ((this.viewMode === "search" && this.searchResults.length === 0 && this.currentQuery) ||
          (this.viewMode === "browse" && this.browseEntries.length === 0) ||
          (this.viewMode === "domain" && this.domainEntries.length === 0) ||
          (this.viewMode === "concordance" && this.concordanceEntries.length === 0)) &&
        !this.dbMissing
          ? html`<div class="no-results">No Elvish entries found for current filter.</div>`
          : ""}
          </div>

          <eldamo-status-footer
            .dbExists=${this.dbInfo.exists}
            .dbPath=${this.dbInfo.path}
            .wordCount=${this.dbInfo.word_count}
            .embeddingModel=${this.dbInfo.embedding_model}
            .inProgress=${this.inProgress}
            .progressPercent=${this.progressPercent}
            .statusText=${this.progressStatusText}
            @open-settings=${() => (this.viewMode = "settings")}
          ></eldamo-status-footer>
        </div>

        <eldamo-right-rail
          .detail=${this.selectedDetail}
          .open=${this.railOpen}
          .loading=${this.detailLoading}
          @select-entry=${this.handleSelectEntry}
          @close-rail=${() => (this.railOpen = false)}
        ></eldamo-right-rail>
      </div>

      <eldamo-about-modal
        .open=${this.aboutOpen}
        @modal-closed=${() => (this.aboutOpen = false)}
      ></eldamo-about-modal>

      <eldamo-welcome-modal
        .open=${this.welcomeOpen}
        .dbExists=${this.dbInfo.exists}
        .dbPath=${this.dbInfo.path}
        .wordCount=${this.dbInfo.word_count}
        @open-downloader=${() => (this.viewMode = "settings")}
        @modal-closed=${() => (this.welcomeOpen = false)}
      ></eldamo-welcome-modal>
    `;
  }
}
