import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { invokeApi } from "../api";
import { WordEntry } from "./result-card";

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  citations?: WordEntry[];
  timestamp: string;
}

@customElement("eldamo-chat-bar")
export class EldamoChatBar extends LitElement {
  @state() private messages: ChatMessage[] = [
    {
      id: "welcome-1",
      sender: "assistant",
      text: "Mae govannen! I am the Eldamo Lexicon Assistant. Ask me anything about Tolkien's Elvish languages, words, roots, or etymologies.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ];
  @state() private inputPrompt = "";
  @state() private loading = false;

  static styles = css`
    :host {
      display: block;
      margin-top: 1rem;
    }

    .chat-container {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 160px);
      background-color: var(--eldamo-surface);
      border: 1px solid var(--eldamo-surface-border);
      border-radius: 12px;
      overflow: hidden;
    }

    .chat-header {
      padding: 0.85rem 1.25rem;
      border-bottom: 1px solid var(--eldamo-surface-border);
      background-color: var(--eldamo-bg);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .chat-title {
      font-family: var(--eldamo-font-serif);
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--eldamo-gold-bright);
      margin: 0;
    }

    .message-list {
      flex: 1;
      overflow-y: auto;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .bubble-user {
      align-self: flex-end;
      max-width: 80%;
      background-color: var(--md-sys-color-primary-container, #2e4578);
      color: var(--md-sys-color-on-primary-container, #d9e2ff);
      padding: 0.75rem 1rem;
      border-radius: 14px 14px 4px 14px;
      font-size: 0.92rem;
      line-height: 1.5;
      white-space: pre-wrap;
    }

    .bubble-assistant {
      align-self: flex-start;
      max-width: 90%;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .who-label {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--eldamo-text-secondary);
    }

    .assistant-text {
      font-size: 0.95rem;
      color: var(--eldamo-text-primary);
      line-height: 1.6;
      white-space: pre-wrap;
    }

    .citations-row {
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
      margin-top: 0.5rem;
      align-items: center;
    }

    .citation-label {
      font-size: 0.75rem;
      color: var(--eldamo-text-secondary);
    }

    .citation-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.2rem 0.6rem;
      border-radius: 12px;
      background-color: var(--md-sys-color-surface-container-high, rgba(255, 255, 255, 0.08));
      border: 1px solid var(--eldamo-surface-border);
      font-size: 0.8rem;
      color: var(--eldamo-gold-bright);
      cursor: pointer;
      transition: background-color 0.15s ease;
    }

    .citation-chip:hover {
      background-color: var(--md-sys-color-primary-container, rgba(176, 198, 255, 0.2));
    }

    .time-stamp {
      font-size: 0.7rem;
      color: var(--eldamo-text-secondary);
      margin-top: 0.2rem;
    }

    .composer-area {
      padding: 0.85rem 1rem;
      border-top: 1px solid var(--eldamo-surface-border);
      background-color: var(--eldamo-bg);
      display: flex;
      gap: 0.75rem;
      align-items: center;
    }

    .composer-input {
      flex: 1;
    }
  `;

  private handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      this.handleSend();
    }
  }

  private async handleSend() {
    const prompt = this.inputPrompt.trim();
    if (!prompt || this.loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    this.messages = [...this.messages, userMsg];
    this.inputPrompt = "";
    this.loading = true;

    try {
      const res: { answer: string; citations?: WordEntry[] } = await invokeApi("ask_assistant", { prompt });
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: "assistant",
        text: res.answer || "No response received.",
        citations: res.citations || [],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      this.messages = [...this.messages, assistantMsg];
    } catch (e) {
      console.error("Assistant query error:", e);
      const errorMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: "assistant",
        text: "Sorry, I encountered an error answering your query.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      this.messages = [...this.messages, errorMsg];
    } finally {
      this.loading = false;
      this.scrollToBottom();
    }
  }

  private scrollToBottom() {
    setTimeout(() => {
      const list = this.shadowRoot?.querySelector(".message-list");
      if (list) {
        list.scrollTop = list.scrollHeight;
      }
    }, 50);
  }

  private handleSelectCitation(pageID: number) {
    this.dispatchEvent(
      new CustomEvent("select-entry", {
        detail: { page_id: pageID },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    return html`
      <div class="chat-container">
        <div class="chat-header">
          <h2 class="chat-title">Eldamo Lexicon Assistant</h2>
          <sl-badge variant="neutral">Lexicon Grounded AI</sl-badge>
        </div>

        <div class="message-list">
          ${this.messages.map(
            (m) => html`
              ${m.sender === "user"
                ? html`
                    <div class="bubble-user">
                      ${m.text}
                      <div class="time-stamp" style="text-align: right; color: rgba(255,255,255,0.7);">${m.timestamp}</div>
                    </div>
                  `
                : html`
                    <div class="bubble-assistant">
                      <div class="who-label">Assistant</div>
                      <div class="assistant-text">${m.text}</div>

                      ${m.citations && m.citations.length > 0
                        ? html`
                            <div class="citations-row">
                              <span class="citation-label">Referenced Lexicon Entries:</span>
                              ${m.citations.map(
                                (c) => html`
                                  <span
                                    class="citation-chip"
                                    @click=${() => this.handleSelectCitation(c.page_id)}
                                  >
                                    <sl-icon name="book"></sl-icon> ${c.v} (${c.l})
                                  </span>
                                `
                              )}
                            </div>
                          `
                        : ""}
                      <div class="time-stamp">${m.timestamp}</div>
                    </div>
                  `}
            `
          )}
          ${this.loading
            ? html`
                <div class="bubble-assistant">
                  <div class="who-label">Assistant</div>
                  <sl-spinner style="font-size: 1.5rem;"></sl-spinner>
                </div>
              `
            : ""}
        </div>

        <div class="composer-area">
          <sl-textarea
            class="composer-input"
            placeholder="Ask a question about Elvish words, grammar, roots, or etymologies..."
            .value=${this.inputPrompt}
            @sl-input=${(e: Event) => (this.inputPrompt = (e.target as HTMLInputElement).value)}
            @keydown=${this.handleKeyDown}
            rows="1"
            resize="none"
          ></sl-textarea>
          <sl-button
            variant="primary"
            ?disabled=${!this.inputPrompt.trim() || this.loading}
            @click=${this.handleSend}
          >
            <sl-icon name="send" slot="prefix"></sl-icon> Send
          </sl-button>
        </div>
      </div>
    `;
  }
}
