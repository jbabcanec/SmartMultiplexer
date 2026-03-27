import { create } from "zustand";

export interface TerminalInfo {
  id: string;
  name: string;
  groupName: string | null;
  shell: string;
  cwd: string;
  status: "running" | "exited";
  exitCode: number | null;
  createdAt: number;
}

export interface Group {
  name: string;
  color: string;
  description: string;
}

export interface Session {
  name: string;
  terminals: { name: string; cwd: string; groupName: string | null }[];
  savedAt: number;
}

// --- Boss chat types ---

export interface BossToolCall {
  id: string;
  name: string;
  input: string;
  result?: string;
  isError?: boolean;
  status: "running" | "done";
}

export interface BossMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: BossToolCall[];
  timestamp: number;
}

export type ThemeMode = "dark" | "light";

export interface AppSettings {
  theme: ThemeMode;
  workspaceRoot: string;
  telegramEnabled: boolean;
  defaultShell: string;
}

const SETTINGS_KEY = "smartterm-settings";

function loadSettings(): AppSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return {
      theme: stored.theme || "dark",
      workspaceRoot: stored.workspaceRoot || "C:\\Users\\josep\\Dropbox\\Babcanec Works\\Programming",
      telegramEnabled: stored.telegramEnabled ?? true,
      defaultShell: stored.defaultShell || "powershell.exe",
    };
  } catch {
    return { theme: "dark", workspaceRoot: "", telegramEnabled: true, defaultShell: "powershell.exe" };
  }
}

function saveSettings(s: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

interface TerminalStore {
  // Terminal state
  terminals: TerminalInfo[];
  order: string[];
  groups: Group[];
  focusedId: string | null;
  maximizedId: string | null;
  minimizedIds: string[];
  bookmarkOpen: boolean;
  bossPanelOpen: boolean;
  settingsOpen: boolean;
  lastLines: Record<string, string>;
  zoom: number;

  // Settings
  settings: AppSettings;

  // Boss chat state
  bossMessages: BossMessage[];
  bossStreaming: boolean;

  // Terminal actions
  setTerminals: (t: TerminalInfo[]) => void;
  addTerminal: (t: TerminalInfo) => void;
  removeTerminal: (id: string) => void;
  updateTerminal: (id: string, patch: Partial<TerminalInfo>) => void;
  reorder: (fromIdx: number, toIdx: number) => void;
  setFocused: (id: string | null) => void;
  setMaximized: (id: string | null) => void;
  toggleMinimized: (id: string) => void;
  setGroups: (g: Group[]) => void;
  setBookmarkOpen: (v: boolean) => void;
  setBossPanelOpen: (v: boolean) => void;
  setLastLine: (id: string, line: string) => void;
  setZoom: (z: number) => void;
  setSettingsOpen: (v: boolean) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;

  // Boss chat actions
  addBossUserMessage: (text: string) => void;
  startBossAssistantMessage: () => void;
  appendBossText: (text: string) => void;
  addBossToolCall: (id: string, name: string) => void;
  appendBossToolInput: (toolUseId: string, json: string) => void;
  setBossToolResult: (toolUseId: string, result: string, isError: boolean) => void;
  finishBossStreaming: () => void;
  clearBossMessages: () => void;
}

let msgCounter = 0;
function nextMsgId() {
  return `msg-${++msgCounter}`;
}

export const useTerminalStore = create<TerminalStore>((set) => ({
  // Terminal state
  terminals: [],
  order: [],
  groups: [],
  focusedId: null,
  maximizedId: null,
  minimizedIds: [],
  bookmarkOpen: true,
  bossPanelOpen: false,
  settingsOpen: false,
  lastLines: {},
  zoom: 13,

  // Settings
  settings: loadSettings(),

  // Boss chat state
  bossMessages: [],
  bossStreaming: false,

  // Terminal actions
  setTerminals: (terminals) =>
    set((s) => ({
      terminals,
      order: terminals.map((t) => t.id),
    })),
  addTerminal: (t) =>
    set((s) => ({
      terminals: [...s.terminals, t],
      order: [...s.order, t.id],
    })),
  removeTerminal: (id) =>
    set((s) => ({
      terminals: s.terminals.filter((t) => t.id !== id),
      order: s.order.filter((oid) => oid !== id),
      minimizedIds: s.minimizedIds.filter((mid) => mid !== id),
      focusedId: s.focusedId === id ? null : s.focusedId,
      maximizedId: s.maximizedId === id ? null : s.maximizedId,
    })),
  updateTerminal: (id, patch) =>
    set((s) => ({
      terminals: s.terminals.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),
  reorder: (fromIdx, toIdx) =>
    set((s) => {
      const next = [...s.order];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return { order: next };
    }),
  setFocused: (focusedId) => set({ focusedId }),
  setMaximized: (maximizedId) => set({ maximizedId }),
  toggleMinimized: (id) =>
    set((s) => ({
      minimizedIds: s.minimizedIds.includes(id)
        ? s.minimizedIds.filter((mid) => mid !== id)
        : [...s.minimizedIds, id],
      maximizedId: s.maximizedId === id ? null : s.maximizedId,
    })),
  setGroups: (groups) => set({ groups }),
  setBookmarkOpen: (bookmarkOpen) => set({ bookmarkOpen }),
  setBossPanelOpen: (bossPanelOpen) => set({ bossPanelOpen }),
  setLastLine: (id, line) =>
    set((s) => ({ lastLines: { ...s.lastLines, [id]: line } })),
  setZoom: (zoom) => set({ zoom: Math.max(8, Math.min(28, zoom)) }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  updateSettings: (patch) =>
    set((s) => {
      const settings = { ...s.settings, ...patch };
      saveSettings(settings);
      return { settings };
    }),

  // Boss chat actions
  addBossUserMessage: (text) =>
    set((s) => ({
      bossMessages: [
        ...s.bossMessages,
        { id: nextMsgId(), role: "user", content: text, timestamp: Date.now() },
      ],
    })),

  startBossAssistantMessage: () =>
    set((s) => ({
      bossStreaming: true,
      bossMessages: [
        ...s.bossMessages,
        {
          id: nextMsgId(),
          role: "assistant",
          content: "",
          toolCalls: [],
          timestamp: Date.now(),
        },
      ],
    })),

  appendBossText: (text) =>
    set((s) => {
      const msgs = [...s.bossMessages];
      const last = msgs[msgs.length - 1];
      if (last?.role === "assistant") {
        msgs[msgs.length - 1] = { ...last, content: last.content + text };
      }
      return { bossMessages: msgs };
    }),

  addBossToolCall: (id, name) =>
    set((s) => {
      const msgs = [...s.bossMessages];
      const last = msgs[msgs.length - 1];
      if (last?.role === "assistant") {
        const toolCalls = [...(last.toolCalls || [])];
        toolCalls.push({ id, name, input: "", status: "running" });
        msgs[msgs.length - 1] = { ...last, toolCalls };
      }
      return { bossMessages: msgs };
    }),

  appendBossToolInput: (toolUseId, json) =>
    set((s) => {
      const msgs = [...s.bossMessages];
      const last = msgs[msgs.length - 1];
      if (last?.role === "assistant" && last.toolCalls) {
        const toolCalls = last.toolCalls.map((tc) =>
          tc.id === toolUseId ? { ...tc, input: tc.input + json } : tc
        );
        msgs[msgs.length - 1] = { ...last, toolCalls };
      }
      return { bossMessages: msgs };
    }),

  setBossToolResult: (toolUseId, result, isError) =>
    set((s) => {
      const msgs = [...s.bossMessages];
      const last = msgs[msgs.length - 1];
      if (last?.role === "assistant" && last.toolCalls) {
        const toolCalls = last.toolCalls.map((tc) =>
          tc.id === toolUseId ? { ...tc, result, isError, status: "done" as const } : tc
        );
        msgs[msgs.length - 1] = { ...last, toolCalls };
      }
      return { bossMessages: msgs };
    }),

  finishBossStreaming: () => set({ bossStreaming: false }),

  clearBossMessages: () => set({ bossMessages: [], bossStreaming: false }),
}));

// --- Session persistence (localStorage) ---

const SESSIONS_KEY = "smartterm-sessions";

export function getSessions(): Session[] {
  try {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveSession(session: Session) {
  const existing = getSessions().filter((s) => s.name !== session.name);
  existing.push(session);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(existing));
}

export function deleteSession(name: string) {
  const filtered = getSessions().filter((s) => s.name !== name);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(filtered));
}
