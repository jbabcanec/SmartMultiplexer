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
