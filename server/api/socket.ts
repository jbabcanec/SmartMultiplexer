import type { Server, Socket } from "socket.io";
import type { TerminalInfo } from "../pty/types.js";
import { writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ptyManager } from "../pty/manager.js";

export function setupSocket(io: Server) {
  // Forward all PtyManager lifecycle events to Socket.IO clients
  ptyManager.on("data", (id: string, data: string) => {
    io.to(`term:${id}`).emit("terminal:data", { id, data });
  });

  ptyManager.on("exit", (id: string, exitCode: number) => {
    io.emit("terminal:exit", { id, exitCode });
  });

  ptyManager.on("created", (info: TerminalInfo) => {
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
    socket.emit("terminal:list", ptyManager.list());

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

    // Boss terminal — spawns an interactive claude session with terminal context
    socket.on("boss:spawn", async (callback) => {
      try {
        const info = ptyManager.spawn({
          name: "Boss",
          shell: "powershell.exe",
        });

        if (callback) callback({ ok: true, id: info.id });

        // Write context to a temp file so claude can read it cleanly
        const contextPath = join(tmpdir(), `smartterm-boss-${info.id.slice(0, 8)}.md`);

        // Wait for PowerShell to be ready (PS prompt appears)
        await ptyManager.waitForOutput(info.id, /PS [A-Z]:/i);

        const summaries = ptyManager.getSummaries(info.id);
        const context = [
          `# SmartTerm Boss Context`,
          ``,
          `You are the Boss agent in SmartTerm, a terminal multiplexer.`,
          `You can see what all other terminals are doing and help coordinate work.`,
          ``,
          `## API (localhost:4800)`,
          ``,
          `You can interact with terminals using these PowerShell commands:`,
          ``,
          "```powershell",
          `# List all terminals`,
          `Invoke-RestMethod http://localhost:4800/api/terminals`,
          ``,
          `# Get last N lines of output from a terminal`,
          `Invoke-RestMethod "http://localhost:4800/api/terminals/<ID>/output?lines=50"`,
          ``,
          `# Send a command to a terminal (include \\r\\n to press Enter)`,
          `Invoke-RestMethod -Method Post -Uri http://localhost:4800/api/terminals/<ID>/input -ContentType "application/json" -Body '{"input":"dir\\r\\n"}'`,
          ``,
          `# Create a new terminal`,
          `Invoke-RestMethod -Method Post -Uri http://localhost:4800/api/terminals -ContentType "application/json" -Body '{"name":"My Task"}'`,
          "```",
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
      } catch (err: any) {
        if (callback) callback({ ok: false, error: err.message });
      }
    });

    // Boss refresh — writes updated context file and sends message to running Claude session
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

      // This gets typed into the running Claude session as a user message
      const escaped = contextPath.replace(/\\/g, "\\\\");
      ptyManager.write(
        bossId,
        `Read ${escaped} for updated terminal state. What changed? Anything need attention?\r`
      );
    });
  });
}
