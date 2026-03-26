import { create } from "zustand";

export interface BossMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface BossStore {
  messages: BossMessage[];
  isThinking: boolean;
  streamingText: string;

  addMessage: (msg: BossMessage) => void;
  setMessages: (msgs: BossMessage[]) => void;
  setThinking: (v: boolean) => void;
  appendStream: (text: string) => void;
  clearStream: () => void;
}

export const useBossStore = create<BossStore>((set) => ({
  messages: [],
  isThinking: false,
  streamingText: "",

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setMessages: (messages) => set({ messages }),
  setThinking: (isThinking) => set({ isThinking }),
  appendStream: (text) => set((s) => ({ streamingText: s.streamingText + text })),
  clearStream: () => set({ streamingText: "" }),
}));
