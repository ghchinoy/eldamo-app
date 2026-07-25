import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("eldamo-header")
export class EldamoHeader extends LitElement {
  @property({ type: String }) viewTitle = "Lexicon Search";
  @property({ type: Boolean }) sidebarCollapsed = false;

  static styles = css`
    :host {
      display: block;
      background-color: var(--eldamo-bg);
      border-bottom: 1px solid var(--eldamo-surface-border);
      padding: 0.75rem 1.25rem;
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .left-cluster {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .view-title {
      font-family: var(--eldamo-font-serif);
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--eldamo-gold-bright);
      margin: 0;
    }
  `;

  private handleToggleSidebar() {
    this.dispatchEvent(new CustomEvent("toggle-sidebar", { bubbles: true, composed: true }));
  }

  render() {
    return html`
      <div class="topbar" data-tauri-drag-region>
        <div class="left-cluster">
          ${this.sidebarCollapsed
            ? html`
                <sl-icon-button
                  name="layout-sidebar"
                  label="Expand Sidebar"
                  @click=${this.handleToggleSidebar}
                ></sl-icon-button>
              `
            : ""}
          <h1 class="view-title">${this.viewTitle}</h1>
        </div>
      </div>
    `;
  }
}
