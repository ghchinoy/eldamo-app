import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { CategoryGroup, Category } from "../api";

@customElement("eldamo-domain-bar")
export class EldamoDomainBar extends LitElement {
  @property({ type: Array }) categoryGroups: CategoryGroup[] = [];
  @property({ type: String }) selectedGroupID = "";
  @property({ type: String }) selectedCategoryID = "";

  static styles = css`
    :host {
      display: block;
      margin-bottom: 1.5rem;
    }

    .domain-container {
      display: flex;
      gap: 1rem;
      align-items: center;
      flex-wrap: wrap;
      background-color: var(--eldamo-surface);
      border: 1px solid var(--eldamo-surface-border);
      border-radius: 8px;
      padding: 1.25rem;
    }

    sl-select {
      flex: 1;
      min-width: 220px;
    }

    .group-label {
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--eldamo-gold);
      margin-bottom: 0.25rem;
    }
  `;

  private handleGroupChange(e: CustomEvent) {
    const target = e.target as HTMLSelectElement;
    this.selectedGroupID = target.value;
    // Default to first category in new group
    const group = this.categoryGroups.find((g) => g.group_id === this.selectedGroupID);
    if (group && group.categories.length > 0) {
      this.selectedCategoryID = group.categories[0].id;
    } else {
      this.selectedCategoryID = "";
    }
    this.emitDomainChange();
  }

  private handleCategoryChange(e: CustomEvent) {
    const target = e.target as HTMLSelectElement;
    this.selectedCategoryID = target.value;
    this.emitDomainChange();
  }

  private emitDomainChange() {
    this.dispatchEvent(
      new CustomEvent("domain-change", {
        detail: {
          category_id: this.selectedCategoryID,
          group_id: this.selectedGroupID,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    const currentGroup = this.categoryGroups.find((g) => g.group_id === this.selectedGroupID);
    const categories: Category[] = currentGroup ? currentGroup.categories : [];

    return html`
      <div class="domain-container">
        <div>
          <div class="group-label">Semantic Domain Group</div>
          <sl-select
            placeholder="Select Category Group..."
            value=${this.selectedGroupID}
            @sl-change=${this.handleGroupChange}
          >
            ${this.categoryGroups.map(
              (g) => html`
                <sl-option value=${g.group_id}>
                  ${g.group_label} (${g.group_id})
                </sl-option>
              `
            )}
          </sl-select>
        </div>

        <div>
          <div class="group-label">Sub-Category</div>
          <sl-select
            placeholder="Select Sub-Category..."
            value=${this.selectedCategoryID}
            @sl-change=${this.handleCategoryChange}
            ?disabled=${categories.length === 0}
          >
            ${categories.map(
              (c) => html`
                <sl-option value=${c.id}>
                  ${c.label} (${c.id}) — ${c.word_count} words
                </sl-option>
              `
            )}
          </sl-select>
        </div>
      </div>
    `;
  }
}
