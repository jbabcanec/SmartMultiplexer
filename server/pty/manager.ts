import * as pty from "node-pty";
import { EventEmitter } from "events";
import { randomUUID } from "crypto";
import type { PtyConfig, TerminalInfo } from "./types.js";
import * as db from "../db/index.js";

const SCROLLBACK_BYTES = 100 * 1024; // 100KB ring buffer per terminal
const DEFAULT_SHELL = process.platform === "win32" ? "powershell.exe" : process.env.SHELL || "/bin/bash";

export class PtyManager extends EventEmitter {
  private ptys = new Map<string, pty.IPty>();
  private buffers = new Map<string, string>();
  private terminalCounter = 0;

  spawn(config: PtyConfig): TerminalInfo {
    const id = randomUUID();
    this.terminalCounter++;
    const name = config.name || `Terminal ${this.terminalCounter}`;
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

    this.ptys.set(id, p);
    this.buffers.set(id, "");

    const now = Date.now();
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
      createdAt: now,
    };

    db.insertTerminal({
      id,
      name,
      group_name: config.groupName || null,
      shell,
      cwd,
      status: "running",
      exit_code: null,
      created_at: now,
    });

    p.onData((data) => {
      // Append to ring buffer
      let buf = (this.buffers.get(id) || "") + data;
      if (buf.length > SCROLLBACK_BYTES) {
        buf = buf.slice(buf.length - SCROLLBACK_BYTES);
      }
      this.buffers.set(id, buf);
      this.emit("data", id, data);
    });

    p.onExit(({ exitCode }) => {
      db.updateTerminal(id, { status: "exited", exit_code: exitCode });
      this.ptys.delete(id);
      this.emit("exit", id, exitCode);
    });

    return info;
  }

  write(id: string, data: string) {
    this.ptys.get(id)?.write(data);
  }

  resize(id: string, cols: number, rows: number) {
    try {
      this.ptys.get(id)?.resize(cols, rows);
    } catch {}
  }

  kill(id: string) {
    const p = this.ptys.get(id);
    if (p) {
      p.kill();
      this.ptys.delete(id);
    }
    db.updateTerminal(id, { status: "exited", exit_code: -1 });
  }

  remove(id: string) {
    this.kill(id);
    this.buffers.delete(id);
    db.deleteTerminal(id);
  }

  getScrollback(id: string): string {
    return this.buffers.get(id) || "";
  }

  getInfo(id: string): TerminalInfo | null {
    const row = db.getTerminal(id);
    if (!row) return null;
    return this.rowToInfo(row);
  }

  list(): TerminalInfo[] {
    return db.listTerminals().map((r) => this.rowToInfo(r));
  }

  isRunning(id: string): boolean {
    return this.ptys.has(id);
  }

  rename(id: string, name: string) {
    db.updateTerminal(id, { name });
  }

  setGroup(id: string, groupName: string | null) {
    db.updateTerminal(id, { group_name: groupName });
  }

  /** Get summaries of all terminals for the boss agent */
  getSummaries(excludeId?: string): string {
    const terminals = this.list().filter((t) => t.id !== excludeId);
    if (terminals.length === 0) return "No other terminals are open.";

    return terminals
      .map((t, i) => {
        const buf = this.buffers.get(t.id) || "";
        // Strip ANSI codes and get last 30 lines
        const clean = buf.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").replace(/\r/g, "");
        const lines = clean.split("\n").filter((l) => l.trim());
        const lastLines = lines.slice(-30).join("\n");
        return `Terminal ${i + 1} "${t.name}" [${t.status}] (cwd: ${t.cwd}):\n${lastLines || "(no output yet)"}`;
      })
      .join("\n\n---\n\n");
  }

  private rowToInfo(row: db.TerminalRow): TerminalInfo {
    return {
      id: row.id,
      name: row.name,
      groupName: row.group_name,
      shell: row.shell,
      cwd: row.cwd,
      cols: 120,
      rows: 30,
      status: row.status as "running" | "exited",
      exitCode: row.exit_code,
      createdAt: row.created_at,
    };
  }
}

export const ptyManager = new PtyManager();
