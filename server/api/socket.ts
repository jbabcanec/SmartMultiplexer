import type { Server, Socket } from "socket.io";
import { ptyManager } from "../pty/manager.js";
import { BossAgent } from "../agents/boss.js";
import { TelegramBridge } from "../agents/telegram.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("socket");

let bossAgent: BossAgent | null = null;
let telegram: TelegramBridge | null = null;

function getBossAgent(): BossAgent | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!bossAgent) {
    bossAgent = new BossAgent(apiKey);
    telegram?.setBossAgent(bossAgent);
  }
  return bossAgent;
}

export function setupSocket(io: Server) {
  // Initialize Boss agent immediately so Telegram works from the start
  const agent = getBossAgent();

  // Set up Telegram bridge if configured
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
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

  // Forward all PtyManager lifecycle events to Socket.IO clients
  ptyManager.on("data", (id: string, data: string) => {
    io.to(`term:${id}`).emit("terminal:data", { id, data });
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

      // Switch to app channel
      telegram?.switchTo("app");

      const agent = getBossAgent();
      if (!agent) {
        log.error("ANTHROPIC_API_KEY not set");
        socket.emit("boss:error", {
          error: "ANTHROPIC_API_KEY not set. Add it to your environment and restart the server.",
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
