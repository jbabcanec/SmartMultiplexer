import type { Server, Socket } from "socket.io";
import { writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ptyManager } from "../pty/manager.js";

export function setupSocket(io: Server) {
  // Forward PTY events to socket rooms
  ptyManager.on("data", (id: string, data: string) => {
    io.to(`term:${id}`).emit("terminal:data", { id, data });
  });

  ptyManager.on("exit", (id: string, exitCode: number) => {
    io.emit("terminal:exit", { id, exitCode });
  });

  io.on("connection", (socket: Socket) => {
    socket.emit("terminal:list", ptyManager.list());

    socket.on("terminal:create", (config, callback) => {
      try {
        const info = ptyManager.spawn(config || {});
        io.emit("terminal:created", info);
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
      io.emit("terminal:removed", id);
    });

    socket.on("terminal:rename", ({ id, name }: { id: string; name: string }) => {
      ptyManager.rename(id, name);
      io.emit("terminal:renamed", { id, name });
    });

    socket.on("terminal:setGroup", ({ id, groupName }: { id: string; groupName: string | null }) => {
      ptyManager.setGroup(id, groupName);
      io.emit("terminal:groupChanged", { id, groupName });
    });

    // Boss terminal — spawns an interactive claude session with terminal context
    socket.on("boss:spawn", (callback) => {
      try {
        const info = ptyManager.spawn({
          name: "Boss",
          shell: "powershell.exe",
        });

        // Write context to a temp file so claude can read it cleanly
        const contextPath = join(tmpdir(), `smartterm-boss-${info.id.slice(0, 8)}.md`);

        setTimeout(() => {
          const summaries = ptyManager.getSummaries(info.id);
          const context = [
            `# SmartTerm Boss Context`,
            ``,
            `You are the Boss agent in SmartTerm, a terminal multiplexer.`,
            `You can see what all other terminals are doing and help coordinate work.`,
            `When the user says "refresh", they will paste updated terminal state.`,
            ``,
            `## Current Terminal State`,
            ``,
            summaries,
          ].join("\n");

          writeFileSync(contextPath, context, "utf-8");

          // Start claude with the context file as the first message
          const escaped = contextPath.replace(/\\/g, "\\\\");
          ptyManager.write(
            info.id,
            `claude "Read ${escaped} for context about the terminals I have open, then give me a brief status summary."\r`
          );
        }, 1500);

        io.emit("terminal:created", info);
        if (callback) callback({ ok: true, id: info.id });
      } catch (err: any) {
        if (callback) callback({ ok: false, error: err.message });
      }
    });

    // Boss refresh — writes updated context file and tells boss to re-read it
    socket.on("boss:refresh", ({ bossId }: { bossId: string }) => {
      const summaries = ptyManager.getSummaries(bossId);
      const contextPath = join(tmpdir(), `smartterm-boss-${bossId.slice(0, 8)}.md`);
      const context = [
        `# SmartTerm Boss Context (refreshed)`,
        ``,
        `## Current Terminal State`,
        ``,
        summaries,
      ].join("\n");

      writeFileSync(contextPath, context, "utf-8");

      const escaped = contextPath.replace(/\\/g, "\\\\");
      ptyManager.write(
        bossId,
        `Re-read ${escaped} — the terminal state has been updated. What changed? Anything need attention?\r`
      );
    });
  });
}
