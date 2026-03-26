import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useTerminalStore } from "../stores/terminalStore";
import { useBossStore } from "../stores/bossStore";

let globalSocket: Socket | null = null;

export function getSocket(): Socket {
  if (!globalSocket) {
    globalSocket = io(window.location.origin, {
      transports: ["websocket", "polling"],
    });
  }
  return globalSocket;
}

export function useSocket() {
  const socketRef = useRef(getSocket());

  useEffect(() => {
    const socket = socketRef.current;

    socket.on("terminal:list", (terminals) => {
      useTerminalStore.getState().setTerminals(terminals);
    });

    socket.on("terminal:created", (info) => {
      useTerminalStore.getState().addTerminal(info);
    });

    socket.on("terminal:exit", ({ id, exitCode }) => {
      useTerminalStore.getState().updateTerminal(id, {
        status: "exited",
        exitCode,
      });
    });

    socket.on("terminal:removed", (id) => {
      useTerminalStore.getState().removeTerminal(id);
    });

    socket.on("terminal:renamed", ({ id, name }) => {
      useTerminalStore.getState().updateTerminal(id, { name });
    });

    socket.on("terminal:groupChanged", ({ id, groupName }) => {
      useTerminalStore.getState().updateTerminal(id, { groupName });
    });

    // Capture last line of output for bookmark sidebar
    socket.on("terminal:data", ({ id, data }) => {
      const clean = data.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").replace(/\r/g, "");
      const lines = clean.split("\n").filter((l: string) => l.trim());
      if (lines.length > 0) {
        useTerminalStore.getState().setLastLine(id, lines[lines.length - 1].trim().slice(0, 120));
      }
    });

    return () => {
      socket.off("terminal:list");
      socket.off("terminal:created");
      socket.off("terminal:exit");
      socket.off("terminal:removed");
      socket.off("terminal:renamed");
      socket.off("terminal:groupChanged");
      socket.off("terminal:data");
    };
  }, []);

  return socketRef.current;
}

export function createTerminal(config?: {
  name?: string;
  cwd?: string;
  shell?: string;
  groupName?: string;
}) {
  getSocket().emit("terminal:create", config || {});
}

export function killTerminal(id: string) {
  getSocket().emit("terminal:kill", id);
}

export function removeTerminal(id: string) {
  getSocket().emit("terminal:remove", id);
}

export function renameTerminal(id: string, name: string) {
  getSocket().emit("terminal:rename", { id, name });
}

export function removeAllTerminals() {
  const terminals = useTerminalStore.getState().terminals;
  terminals.forEach((t) => getSocket().emit("terminal:remove", t.id));
}

export function sendBossMessage(content: string) {
  const store = useBossStore.getState();
  store.addMessage({ role: "user", content, timestamp: Date.now() });
  store.clearStream();
  store.setThinking(true);

  const socket = getSocket();

  const onChunk = (text: string) => {
    useBossStore.getState().appendStream(text);
  };

  const onDone = () => {
    const stream = useBossStore.getState().streamingText;
    if (stream) {
      useBossStore.getState().addMessage({
        role: "assistant",
        content: stream,
        timestamp: Date.now(),
      });
    }
    useBossStore.getState().clearStream();
    useBossStore.getState().setThinking(false);
    socket.off("boss:chunk", onChunk);
    socket.off("boss:done", onDone);
  };

  socket.on("boss:chunk", onChunk);
  socket.on("boss:done", onDone);
  socket.emit("boss:message", content);
}
