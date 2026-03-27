import { createLogger } from "../lib/logger.js";
import type { BossAgent, BossChunk, ChunkCallback } from "./boss.js";

const log = createLogger("telegram");

const POLL_INTERVAL = 1500; // check for new messages every 1.5s

export type ActiveChannel = "app" | "telegram";

export class TelegramBridge {
  private botToken: string;
  private chatId: string;
  private offset = 0;
  private polling = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private bossAgent: BossAgent | null = null;
  private onChannelSwitch: (channel: ActiveChannel) => void;
  /** Called to mirror chunks to the app UI */
  onChunkForApp: ChunkCallback | null = null;
  /** Called when a user message arrives from Telegram */
  onUserMessageForApp: ((text: string) => void) | null = null;

  activeChannel: ActiveChannel = "app";

  constructor(
    botToken: string,
    chatId: string,
    onChannelSwitch: (channel: ActiveChannel) => void
  ) {
    this.botToken = botToken;
    this.chatId = chatId;
    this.onChannelSwitch = onChannelSwitch;
    log.info("TelegramBridge initialized");
  }

  setBossAgent(agent: BossAgent) {
    this.bossAgent = agent;
  }

  switchTo(channel: ActiveChannel) {
    if (this.activeChannel !== channel) {
      this.activeChannel = channel;
      log.info(`Channel switched to: ${channel}`);
      this.onChannelSwitch(channel);
    }
  }

  /** Track last notification per terminal to avoid spam */
  private lastNotifiedTerminal = new Map<string, number>();

  startPolling() {
    if (this.polling) return;
    this.polling = true;
    this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL);
    log.info("Telegram polling started");
  }

  /** Call this when terminal output looks like it needs attention */
  async notifyIfAway(terminalName: string, terminalId: string, reason: string) {
    if (this.activeChannel !== "telegram") return; // user is at the app
    // Don't spam — once per terminal per 60 seconds
    const lastTime = this.lastNotifiedTerminal.get(terminalId) || 0;
    if (Date.now() - lastTime < 60000) return;
    this.lastNotifiedTerminal.set(terminalId, Date.now());
    await this.send(`[${terminalName}] ${reason}`);
  }

  async notifyShutdown() {
    await this.send("SmartTerm is shutting down. All terminals will be killed.");
  }

  stopPolling() {
    this.polling = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    log.info("Telegram polling stopped");
  }

  private async poll() {
    try {
      const url = `https://api.telegram.org/bot${this.botToken}/getUpdates?offset=${this.offset}&timeout=0&limit=10`;
      const res = await fetch(url);
      const data = (await res.json()) as any;

      if (!data.ok || !data.result?.length) return;

      for (const update of data.result) {
        this.offset = update.update_id + 1;

        const msg = update.message;
        if (!msg?.text || String(msg.chat.id) !== this.chatId) continue;

        const text = msg.text.trim();
        if (text.startsWith("/start")) continue; // ignore /start

        log.info(`Telegram message: "${text.slice(0, 80)}"`);

        this.switchTo("telegram");

        // Show user message in app UI
        this.onUserMessageForApp?.(text);

        await this.handleMessage(text);
      }
    } catch (err: any) {
      log.warn("Telegram poll error", err.message);
    }
  }

  private async handleMessage(text: string) {
    if (!this.bossAgent) {
      await this.send("Boss agent not ready. Open SmartTerm first.");
      return;
    }

    // Collect the full response
    let responseText = "";
    let toolSummaries: string[] = [];

    try {
      await this.bossAgent.processMessage(text, (chunk: BossChunk) => {
        // Mirror everything to the app UI
        this.onChunkForApp?.(chunk);

        // Collect for Telegram response
        switch (chunk.type) {
          case "text_delta":
            responseText += chunk.text || "";
            break;
          case "tool_use_start":
            toolSummaries.push(`> ${chunk.toolName}`);
            break;
          case "notification":
            this.send(`${chunk.title}\n${chunk.body}`);
            break;
          case "error":
            responseText += `\nError: ${chunk.error}`;
            break;
        }
      });
    } catch (err: any) {
      responseText = `Error: ${err.message}`;
    }

    // Send the collected response
    let message = "";
    if (toolSummaries.length > 0) {
      message += toolSummaries.join("\n") + "\n\n";
    }
    message += responseText.trim();

    if (message) {
      // Telegram has a 4096 char limit per message
      if (message.length > 4000) {
        message = message.slice(0, 3997) + "...";
      }
      await this.send(message);
    }
  }

  async send(text: string) {
    if (!text.trim()) return;
    log.info(`Sending to Telegram (${text.length} chars)`);
    try {
      // Send as plain text — Markdown parsing is too fragile with code output
      const res = await fetch(
        `https://api.telegram.org/bot${this.botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: this.chatId, text }),
        }
      );
      const data = await res.json() as any;
      if (!data.ok) {
        log.error("Telegram API error", data.description);
      }
    } catch (err: any) {
      log.error("Telegram send failed", err.message);
    }
  }
}
