import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useTerminalStore } from "../stores/terminalStore";

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
    const onTermData = ({ id, data }: { id: string; data: string }) => {
      const clean = data.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").replace(/\r/g, "");
      const lines = clean.split("\n").filter((l: string) => l.trim());
      if (lines.length > 0) {
        useTerminalStore.getState().setLastLine(id, lines[lines.length - 1].trim().slice(0, 120));
      }
    };
    socket.on("terminal:data", onTermData);

    return () => {
      socket.off("terminal:list");
      socket.off("terminal:created");
      socket.off("terminal:exit");
      socket.off("terminal:removed");
      socket.off("terminal:renamed");
      socket.off("terminal:groupChanged");
      socket.off("terminal:data", onTermData);
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
