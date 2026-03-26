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

interface TerminalStore {
  terminals: TerminalInfo[];
  order: string[];
  groups: Group[];
  focusedId: string | null;
  maximizedId: string | null;
  minimizedIds: string[];
  bookmarkOpen: boolean;
  bossPanelOpen: boolean;
  lastLines: Record<string, string>;
  zoom: number;
  bossTerminalId: string | null;

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
  setBossTerminalId: (id: string | null) => void;
}

export const useTerminalStore = create<TerminalStore>((set) => ({
  terminals: [],
  order: [],
  groups: [],
  focusedId: null,
  maximizedId: null,
  minimizedIds: [],
  bookmarkOpen: true,
  bossPanelOpen: false,
  lastLines: {},
  zoom: 13,
  bossTerminalId: null,

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
  setBossTerminalId: (bossTerminalId) => set({ bossTerminalId }),
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
