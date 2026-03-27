import type { IPty } from "node-pty";

export interface PtyConfig {
  name?: string;
  shell?: string;
  cwd?: string;
  cols?: number;
  rows?: number;
  groupName?: string;
}

export interface TerminalInfo {
  id: string;
  name: string;
  groupName: string | null;
  shell: string;
  cwd: string;
  cols: number;
  rows: number;
  status: "running" | "exited";
  exitCode: number | null;
  createdAt: number;
}

/** Internal to PtyManager — not exposed to clients */
export interface ManagedTerminal {
  info: TerminalInfo;
  process: IPty | null; // null after exit
  buffer: string;
}
