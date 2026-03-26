import type { Server, Socket } from "socket.io";
import { ptyManager } from "../pty/manager.js";
import { handleBossMessage } from "../boss/boss.js";
import * as db from "../db/index.js";

export function setupSocket(io: Server) {
  // Forward PTY events to socket rooms
  ptyManager.on("data", (id: string, data: string) => {
    io.to(`term:${id}`).emit("terminal:data", { id, data });
  });

  ptyManager.on("exit", (id: string, exitCode: number) => {
    io.emit("terminal:exit", { id, exitCode });
  });

  io.on("connection", (socket: Socket) => {
    // Send current terminal list on connect
    socket.emit("terminal:list", ptyManager.list());

    // Create terminal
    socket.on("terminal:create", (config, callback) => {
      try {
        const info = ptyManager.spawn(config || {});
        io.emit("terminal:created", info);
        if (callback) callback({ ok: true, terminal: info });
      } catch (err: any) {
        if (callback) callback({ ok: false, error: err.message });
      }
    });

    // Subscribe to terminal output
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

    // Terminal input (keystrokes)
    socket.on("terminal:input", ({ id, data }: { id: string; data: string }) => {
      ptyManager.write(id, data);
    });

    // Terminal resize
    socket.on("terminal:resize", ({ id, cols, rows }: { id: string; cols: number; rows: number }) => {
      ptyManager.resize(id, cols, rows);
    });

    // Kill terminal
    socket.on("terminal:kill", (id: string) => {
      ptyManager.kill(id);
    });

    // Remove terminal
    socket.on("terminal:remove", (id: string) => {
      ptyManager.remove(id);
      io.emit("terminal:removed", id);
    });

    // Rename terminal
    socket.on("terminal:rename", ({ id, name }: { id: string; name: string }) => {
      ptyManager.rename(id, name);
      io.emit("terminal:renamed", { id, name });
    });

    // Set group
    socket.on("terminal:setGroup", ({ id, groupName }: { id: string; groupName: string | null }) => {
      ptyManager.setGroup(id, groupName);
      io.emit("terminal:groupChanged", { id, groupName });
    });

    // Boss agent
    socket.on("boss:message", async (content: string) => {
      socket.emit("boss:thinking", true);
      try {
        const { commands } = await handleBossMessage(content, (chunk) => {
          socket.emit("boss:chunk", chunk);
        });
        socket.emit("boss:done", { commands });
      } catch (err: any) {
        socket.emit("boss:chunk", `\nError: ${err.message}`);
        socket.emit("boss:done", { commands: [] });
      }
      socket.emit("boss:thinking", false);
    });

    // Boss history
    socket.on("boss:getHistory", (callback) => {
      const msgs = db.listBossMessages(50).reverse();
      if (callback) callback(msgs);
    });
  });
}
