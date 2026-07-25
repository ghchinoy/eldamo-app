import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { WordEntry } from "./result-card";

export interface HistoryItem {
  page_id: number;
  v: string;
  l: string;
  gloss: string;
}

const RECENT_KEY = "eldamo_recent_entries";
const PINNED_KEY = "eldamo_pinned_entries";

export function getRecentEntries(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addRecentEntry(entry: WordEntry): HistoryItem[] {
  const list = getRecentEntries().filter((item) => item.page_id !== entry.page_id);
  const newItem: HistoryItem = {
    page_id: entry.page_id,
    v: entry.v,
    l: entry.l,
    gloss: entry.gloss || "",
  };
  const updated = [newItem, ...list].slice(0, 15);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to save recent entries:", e);
  }
  return updated;
}

export function getPinnedEntries(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(PINNED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function togglePinEntry(item: HistoryItem): HistoryItem[] {
  const current = getPinnedEntries();
  const exists = current.some((p) => p.page_id === item.page_id);
  const updated = exists
    ? current.filter((p) => p.page_id !== item.page_id)
    : [item, ...current];
  try {
    localStorage.setItem(PINNED_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to save pinned entries:", e);
  }
  return updated;
}

@customElement("eldamo-sidebar")
export class EldamoSidebar extends LitElement {
  @property({ type: String }) viewMode: "search" | "browse" | "domain" | "concordance" | "transliterator" | "chat" | "settings" = "search";
  @property({ type: Boolean }) collapsed = false;

  @state() private recentList: HistoryItem[] = [];
  @state() private pinnedList: HistoryItem[] = [];

  static styles = css`
    :host {
      display: block;
      height: 100%;
      background-color: var(--eldamo-surface);
      border-right: 1px solid var(--eldamo-surface-border);
      box-sizing: border-box;
      user-select: none;
    }

    .sidebar-inner {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 0.75rem 0.5rem;
      box-sizing: border-box;
    }

    .brand-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem 0.5rem 1rem 0.5rem;
    }

    .brand-wordmark {
      font-family: var(--eldamo-font-serif);
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--eldamo-gold-bright);
      margin: 0;
    }

    .nav-section {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      margin-bottom: 1.25rem;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0.75rem;
      border-radius: 8px;
      color: var(--eldamo-text-secondary);
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.15s ease, color 0.15s ease;
    }

    .nav-item:hover {
      background-color: var(--md-sys-color-surface-container-high, rgba(255, 255, 255, 0.05));
      color: var(--eldamo-text-primary);
    }

    .nav-item.active {
      background-color: var(--md-sys-color-primary-container, rgba(176, 198, 255, 0.15));
      color: var(--eldamo-gold-bright);
      font-weight: 600;
    }

    .section-header {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--eldamo-text-secondary);
      padding: 0.5rem 0.75rem 0.25rem 0.75rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .history-scroll {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .history-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.4rem 0.75rem;
      border-radius: 6px;
      font-size: 0.85rem;
      color: var(--eldamo-text-primary);
      cursor: pointer;
    }

    .history-item:hover {
      background-color: var(--md-sys-color-surface-container-high, rgba(255, 255, 255, 0.05));
    }

    .history-item .word {
      font-weight: 600;
      color: var(--eldamo-gold-bright);
    }

    .history-item .lang {
      font-size: 0.75rem;
      color: var(--eldamo-text-secondary);
    }

    .pin-icon {
      opacity: 0;
      cursor: pointer;
      transition: opacity 0.15s ease;
    }

    .history-item:hover .pin-icon,
    .history-item.pinned .pin-icon {
      opacity: 1;
    }

    .footer-row {
      border-top: 1px solid var(--eldamo-surface-border);
      padding-top: 0.75rem;
      margin-top: auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-left: 0.25rem;
      padding-right: 0.25rem;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.refreshHistory();
  }

  refreshHistory() {
    this.recentList = getRecentEntries();
    this.pinnedList = getPinnedEntries();
  }

  private handleModeSelect(mode: "search" | "browse" | "domain" | "concordance" | "transliterator" | "chat" | "settings") {
    this.dispatchEvent(
      new CustomEvent("mode-change", {
        detail: { mode },
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleToggleCollapse() {
    this.dispatchEvent(
      new CustomEvent("toggle-sidebar", {
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleSelectHistory(item: HistoryItem) {
    this.dispatchEvent(
      new CustomEvent("select-entry", {
        detail: { page_id: item.page_id },
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleTogglePin(e: Event, item: HistoryItem) {
    e.stopPropagation();
    this.pinnedList = togglePinEntry(item);
  }

  private handleOpenSettings() {
    this.dispatchEvent(new CustomEvent("open-settings", { bubbles: true, composed: true }));
  }

  private handleOpenAbout() {
    this.dispatchEvent(new CustomEvent("open-about", { bubbles: true, composed: true }));
  }

  render() {
    const isPinned = (id: number) => this.pinnedList.some((p) => p.page_id === id);

    return html`
      <div class="sidebar-inner">
        <div class="brand-row" data-tauri-drag-region>
          <div class="brand-wordmark">Eldamo</div>
          <sl-icon-button
            name="layout-sidebar"
            label="Toggle Sidebar"
            @click=${this.handleToggleCollapse}
          ></sl-icon-button>
        </div>

        <div class="nav-section">
          <div
            class="nav-item ${this.viewMode === "search" ? "active" : ""}"
            @click=${() => this.handleModeSelect("search")}
          >
            <sl-icon name="search"></sl-icon>
            <span>Search</span>
          </div>

          <div
            class="nav-item ${this.viewMode === "browse" ? "active" : ""}"
            @click=${() => this.handleModeSelect("browse")}
          >
            <sl-icon name="sort-alpha-down"></sl-icon>
            <span>Browse A-Z</span>
          </div>

          <div
            class="nav-item ${this.viewMode === "domain" ? "active" : ""}"
            @click=${() => this.handleModeSelect("domain")}
          >
            <sl-icon name="diagram-3"></sl-icon>
            <span>Domains</span>
          </div>

          <div
            class="nav-item ${this.viewMode === "concordance" ? "active" : ""}"
            @click=${() => this.handleModeSelect("concordance")}
          >
            <sl-icon name="book"></sl-icon>
            <span>Concordance</span>
          </div>

          <div
            class="nav-item ${this.viewMode === "transliterator" ? "active" : ""}"
            @click=${() => this.handleModeSelect("transliterator")}
          >
            <sl-icon name="pen"></sl-icon>
            <span>Tengwar</span>
          </div>

          <div
            class="nav-item ${this.viewMode === "chat" ? "active" : ""}"
            @click=${() => this.handleModeSelect("chat")}
          >
            <sl-icon name="chat-dots"></sl-icon>
            <span>Lexicon Assistant</span>
          </div>
        </div>

        <div class="history-scroll">
          ${this.pinnedList.length > 0
            ? html`
                <div class="section-header">Pinned Entries</div>
                ${this.pinnedList.map(
                  (item) => html`
                    <div class="history-item pinned" @click=${() => this.handleSelectHistory(item)}>
                      <div>
                        <span class="word">${item.v}</span>
                        <span class="lang">(${item.l})</span>
                      </div>
                      <sl-icon
                        class="pin-icon"
                        name="pin-fill"
                        @click=${(e: Event) => this.handleTogglePin(e, item)}
                      ></sl-icon>
                    </div>
                  `
                )}
              `
            : ""}

          ${this.recentList.length > 0
            ? html`
                <div class="section-header">Recent Entries</div>
                ${this.recentList.map(
                  (item) => html`
                    <div class="history-item" @click=${() => this.handleSelectHistory(item)}>
                      <div>
                        <span class="word">${item.v}</span>
                        <span class="lang">(${item.l})</span>
                      </div>
                      <sl-icon
                        class="pin-icon"
                        name=${isPinned(item.page_id) ? "pin-fill" : "pin"}
                        @click=${(e: Event) => this.handleTogglePin(e, item)}
                      ></sl-icon>
                    </div>
                  `
                )}
              `
            : ""}
        </div>

        <div class="footer-row">
          <sl-button size="small" variant="text" @click=${this.handleOpenAbout}>
            <sl-icon name="info-circle" slot="prefix"></sl-icon> About
          </sl-button>
          <sl-button size="small" variant="text" @click=${this.handleOpenSettings}>
            <sl-icon name="gear" slot="prefix"></sl-icon> Settings
          </sl-button>
        </div>
      </div>
    `;
  }
}
