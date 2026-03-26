import { useEffect } from "react";
import { useTerminalStore } from "../stores/terminalStore";
import { createTerminal, removeTerminal } from "./useSocket";

declare global {
  interface Window {
    smartterm?: {
      onShortcut: (cb: (action: string) => void) => void;
      platform: string;
      isElectron: boolean;
    };
  }
}

export function useShortcuts() {
  useEffect(() => {
    const handle = (action: string) => {
      const store = useTerminalStore.getState();

      switch (action) {
        case "new-terminal":
          createTerminal();
          break;

        case "close-terminal": {
          const focused = store.focusedId;
          if (focused) removeTerminal(focused);
          break;
        }

        case "toggle-boss":
          store.setBossPanelOpen(!store.bossPanelOpen);
          break;

        case "next-terminal": {
          const { terminals, order, focusedId } = store;
          if (order.length === 0) break;
          const idx = focusedId ? order.indexOf(focusedId) : -1;
          const nextIdx = (idx + 1) % order.length;
          store.setFocused(order[nextIdx]);
          break;
        }

        case "prev-terminal": {
          const { order: ord, focusedId: fid } = store;
          if (ord.length === 0) break;
          const idx2 = fid ? ord.indexOf(fid) : 0;
          const prevIdx = (idx2 - 1 + ord.length) % ord.length;
          store.setFocused(ord[prevIdx]);
          break;
        }

        case "zoom-in":
          store.setZoom(store.zoom + 1);
          break;
        case "zoom-out":
          store.setZoom(store.zoom - 1);
          break;
        case "zoom-reset":
          store.setZoom(13);
          break;
      }
    };

    // Electron shortcuts via IPC
    if (window.smartterm?.onShortcut) {
      window.smartterm.onShortcut(handle);
    }

    // Browser fallback shortcuts
    const onKeyDown = (e: KeyboardEvent) => {
      if (window.smartterm?.isElectron) return; // handled by Electron
      if (!e.ctrlKey) return;

      if (e.key === "t" && !e.shiftKey) {
        e.preventDefault();
        handle("new-terminal");
      } else if (e.key === "w" && !e.shiftKey) {
        e.preventDefault();
        handle("close-terminal");
      } else if (e.key === "b" && !e.shiftKey) {
        e.preventDefault();
        handle("toggle-boss");
      } else if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        handle("zoom-in");
      } else if (e.key === "-") {
        e.preventDefault();
        handle("zoom-out");
      } else if (e.key === "0") {
        e.preventDefault();
        handle("zoom-reset");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
