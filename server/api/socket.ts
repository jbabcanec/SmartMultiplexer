import type { Server, Socket } from "socket.io";
import { ptyManager } from "../pty/manager.js";
import { BossAgent } from "../agents/boss.js";
import { TelegramBridge } from "../agents/telegram.js";
import { createLogger } from "../lib/logger.js";
import { loadConfig } from "../lib/config.js";

const log = createLogger("socket");

let bossAgent: BossAgent | null = null;
let telegram: TelegramBridge | null = null;

export function getTelegram() { return telegram; }

function getBossAgent(): BossAgent | null {
  const config = loadConfig();
  if (!config.anthropicApiKey) return null;
  if (!bossAgent) {
    bossAgent = new BossAgent(config.anthropicApiKey);
    telegram?.setBossAgent(bossAgent);
  }
  return bossAgent;
}

export function setupSocket(io: Server) {
  const config = loadConfig();

  // Initialize Boss agent immediately so Telegram works from the start
  const agent = getBossAgent();

  // Set up Telegram bridge if configured
  const botToken = config.telegramBotToken;
  const chatId = config.telegramChatId;
  if (botToken && chatId) {
    telegram = new TelegramBridge(botToken, chatId, (channel) => {
      io.emit("boss:channel", { channel });
    });
    if (agent) telegram.setBossAgent(agent);
    // Mirror Telegram conversation to app UI
    telegram.onUserMessageForApp = (text) => {
      io.emit("boss:telegram-user-message", { text });
    };
    telegram.onChunkForApp = (chunk) => {
      io.emit("boss:chunk", chunk);
    };
    telegram.startPolling();
  }

  // --- Proactive terminal monitoring ---
  // Track recent output per terminal to detect when something needs attention
  const recentOutput = new Map<string, string>();
  const idleTimers = new Map<string, ReturnType<typeof setTimeout>>();

  // Only match real "waiting for input" prompts — NOT general output
  const ATTENTION_PATTERNS = [
    /\[y\/n\]/i,                       // [y/N] [Y/n]
    /\(yes\/no\)/i,                    // (yes/no)
    /\[Y\/n\]/,                        // explicit Y/n
    /press enter to continue/i,        // explicit "press enter"
    /Do you want to proceed/i,         // explicit proceed prompt
    /trust this folder/i,              // Claude Code trust prompt
    /Are you sure/i,                   // confirmation prompt
  ];

  function checkForAttention(id: string) {
    if (!telegram) return;
    const buf = recentOutput.get(id) || "";
    const info = ptyManager.getInfo(id);
    if (!info) return;

    // Strip ANSI and get last few lines
    const clean = buf
      .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "")
      .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "")
      .replace(/\x1b[>=<][0-9]*[a-zA-Z]/g, "")
      .replace(/\r/g, "");
    const lines = clean.split("\n").filter((l) => l.trim()).slice(-5);
    const lastLines = lines.join(" ");

    for (const pattern of ATTENTION_PATTERNS) {
      if (pattern.test(lastLines)) {
        const match = lastLines.match(pattern)?.[0] || "";
        const snippet = lines.slice(-2).join(" ").slice(0, 100);
        telegram.notifyIfAway(info.name, id, snippet);
        break;
      }
    }
  }

  // Forward all PtyManager lifecycle events to Socket.IO clients
  ptyManager.on("data", (id: string, data: string) => {
    io.to(`term:${id}`).emit("terminal:data", { id, data });

    // Accumulate recent output and check after idle
    const existing = recentOutput.get(id) || "";
    const updated = (existing + data).slice(-4000); // keep last 4KB
    recentOutput.set(id, updated);

    // Reset idle timer — check 15 seconds after last output (truly idle)
    const timer = idleTimers.get(id);
    if (timer) clearTimeout(timer);
    idleTimers.set(id, setTimeout(() => checkForAttention(id), 15000));
  });

  ptyManager.on("exit", (id: string, exitCode: number) => {
    io.emit("terminal:exit", { id, exitCode });
  });

  ptyManager.on("created", (info) => {
    io.emit("terminal:created", info);
  });

  ptyManager.on("removed", (id: string) => {
    io.emit("terminal:removed", id);
  });

  ptyManager.on("renamed", (id: string, name: string) => {
    io.emit("terminal:renamed", { id, name });
  });

  ptyManager.on("groupChanged", (id: string, groupName: string | null) => {
    io.emit("terminal:groupChanged", { id, groupName });
  });

  io.on("connection", (socket: Socket) => {
    log.info(`Client connected (${socket.id})`);
    socket.emit("terminal:list", ptyManager.list());

    // Tell client current channel
    if (telegram) {
      socket.emit("boss:channel", { channel: telegram.activeChannel });
    }

    // --- Terminal handlers ---

    socket.on("terminal:create", (config, callback) => {
      try {
        const info = ptyManager.spawn(config || {});
        if (callback) callback({ ok: true, terminal: info });
      } catch (err: any) {
        if (callback) callback({ ok: false, error: err.message });
      }
    });

    socket.on("terminal:subscribe", (id: string) => {
      socket.join(`term:${id}`);
      const scrollback = ptyManager.getScrollback(id);
      if (scrollback) {
        socket.emit("terminal:data", { id, data: scrollback });
      }
    });

    socket.on("terminal:unsubscribe", (id: string) => {
      socket.leave(`term:${id}`);
    });

    socket.on("terminal:input", ({ id, data }: { id: string; data: string }) => {
      ptyManager.write(id, data);
    });

    socket.on("terminal:resize", ({ id, cols, rows }: { id: string; cols: number; rows: number }) => {
      ptyManager.resize(id, cols, rows);
    });

    socket.on("terminal:kill", (id: string) => {
      ptyManager.kill(id);
    });

    socket.on("terminal:remove", (id: string) => {
      ptyManager.remove(id);
    });

    socket.on("terminal:rename", ({ id, name }: { id: string; name: string }) => {
      ptyManager.rename(id, name);
    });

    socket.on("terminal:setGroup", ({ id, groupName }: { id: string; groupName: string | null }) => {
      ptyManager.setGroup(id, groupName);
    });

    // --- Boss agent handlers ---

    socket.on("boss:message", async ({ text }: { text: string }, callback?: Function) => {
      log.info(`Boss message (app): "${text.slice(0, 80)}${text.length > 80 ? "..." : ""}"`);

      telegram?.switchTo("app");

      const agent = getBossAgent();
      if (!agent) {
        socket.emit("boss:error", {
          error: "No API key configured. Open Settings to add your Anthropic API key.",
        });
        if (callback) callback({ ok: false, error: "No API key" });
        return;
      }

      if (callback) callback({ ok: true });

      try {
        await agent.processMessage(text, (chunk) => {
          socket.emit("boss:chunk", chunk);
        });
      } catch (err: any) {
        socket.emit("boss:error", { error: err.message });
      }
    });

    socket.on("boss:clear", () => {
      bossAgent?.clearHistory();
      socket.emit("boss:cleared");
    });

    socket.on("boss:abort", () => {
      bossAgent?.abort();
    });
  });
}
