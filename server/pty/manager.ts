import * as pty from "node-pty";
import { EventEmitter } from "events";
import { randomUUID } from "crypto";
import type { PtyConfig, TerminalInfo, ManagedTerminal } from "./types.js";

const SCROLLBACK_BYTES = 100 * 1024; // 100KB ring buffer per terminal
const DEFAULT_SHELL = process.platform === "win32" ? "powershell.exe" : process.env.SHELL || "/bin/bash";

export class PtyManager extends EventEmitter {
  private terminals = new Map<string, ManagedTerminal>();

  /** Derive next "Terminal N" number from living terminals */
  private nextTerminalNumber(): number {
    let max = 0;
    for (const t of this.terminals.values()) {
      const m = t.info.name.match(/^Terminal (\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return max + 1;
  }

  spawn(config: PtyConfig): TerminalInfo {
    const id = randomUUID();
    const name = config.name || `Terminal ${this.nextTerminalNumber()}`;
    const shell = config.shell || DEFAULT_SHELL;
    const cwd = config.cwd || process.cwd();
    const cols = config.cols || 120;
    const rows = config.rows || 30;

    const p = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols,
      rows,
      cwd,
      env: { ...process.env } as Record<string, string>,
      useConpty: process.platform === "win32",
    });

    const info: TerminalInfo = {
      id,
      name,
      groupName: config.groupName || null,
      shell,
      cwd,
      cols,
      rows,
      status: "running",
      exitCode: null,
      createdAt: Date.now(),
    };

    const managed: ManagedTerminal = { info, process: p, buffer: "" };
    this.terminals.set(id, managed);

    p.onData((data) => {
      let buf = managed.buffer + data;
      if (buf.length > SCROLLBACK_BYTES) {
        buf = buf.slice(buf.length - SCROLLBACK_BYTES);
      }
      managed.buffer = buf;
      this.emit("data", id, data);
    });

    p.onExit(({ exitCode }) => {
      managed.info.status = "exited";
      managed.info.exitCode = exitCode;
      managed.process = null;
      this.emit("exit", id, exitCode);
    });

    this.emit("created", info);
    return info;
  }

  write(id: string, data: string) {
    this.terminals.get(id)?.process?.write(data);
  }

  resize(id: string, cols: number, rows: number) {
    const t = this.terminals.get(id);
    if (!t?.process) return;
    try {
      t.process.resize(cols, rows);
      t.info.cols = cols;
      t.info.rows = rows;
    } catch {}
  }

  /** Stop the process but keep the terminal visible (scrollback preserved) */
  kill(id: string) {
    const t = this.terminals.get(id);
    if (!t) return;
    if (t.process) {
      t.process.kill();
      t.process = null;
    }
    t.info.status = "exited";
    t.info.exitCode = -1;
  }

  /** Destroy entirely — process, buffer, all memory of it */
  remove(id: string) {
    this.kill(id);
    this.terminals.delete(id);
    this.emit("removed", id);
  }

  getScrollback(id: string): string {
    return this.terminals.get(id)?.buffer || "";
  }

  getInfo(id: string): TerminalInfo | null {
    const t = this.terminals.get(id);
    return t ? { ...t.info } : null;
  }

  list(): TerminalInfo[] {
    return Array.from(this.terminals.values()).map((t) => ({ ...t.info }));
  }

  isRunning(id: string): boolean {
    return this.terminals.get(id)?.process != null;
  }

  rename(id: string, name: string) {
    const t = this.terminals.get(id);
    if (!t) return;
    t.info.name = name;
    this.emit("renamed", id, name);
  }

  setGroup(id: string, groupName: string | null) {
    const t = this.terminals.get(id);
    if (!t) return;
    t.info.groupName = groupName;
    this.emit("groupChanged", id, groupName);
  }

  /** Get summaries of all terminals for the boss agent */
  getSummaries(excludeId?: string): string {
    const terminals = this.list().filter((t) => t.id !== excludeId);
    if (terminals.length === 0) return "No other terminals are open.";

    return terminals
      .map((t) => {
        const buf = this.terminals.get(t.id)?.buffer || "";
        const clean = buf.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").replace(/\r/g, "");
        const lines = clean.split("\n").filter((l) => l.trim());
        const lastLines = lines.slice(-30).join("\n");
        return `"${t.name}" [${t.status}] (cwd: ${t.cwd}):\n${lastLines || "(no output yet)"}`;
      })
      .join("\n\n---\n\n");
  }

  /** Wait for the terminal output to match a pattern (ANSI codes stripped), then resolve */
  waitForOutput(id: string, pattern: RegExp, timeoutMs = 15000): Promise<void> {
    const strip = (s: string) => s.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").replace(/\r/g, "");

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.removeListener("data", onData);
        reject(new Error("Timed out waiting for terminal output"));
      }, timeoutMs);

      const onData = (dataId: string) => {
        if (dataId !== id) return;
        const buf = this.terminals.get(id)?.buffer || "";
        if (pattern.test(strip(buf))) {
          clearTimeout(timer);
          this.removeListener("data", onData);
          resolve();
        }
      };

      const buf = this.terminals.get(id)?.buffer || "";
      if (pattern.test(strip(buf))) {
        resolve();
        return;
      }
      this.on("data", onData);
    });
  }
}

export const ptyManager = new PtyManager();
