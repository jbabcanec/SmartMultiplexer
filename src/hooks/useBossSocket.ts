import { useEffect } from "react";
import { getSocket } from "./useSocket";
import { useTerminalStore } from "../stores/terminalStore";

export function useBossSocket() {
  useEffect(() => {
    const socket = getSocket();

    socket.on("boss:chunk", (chunk: any) => {
      const s = useTerminalStore.getState();

      switch (chunk.type) {
        case "text_delta":
          if (!s.bossStreaming) s.startBossAssistantMessage();
          s.appendBossText(chunk.text);
          break;
        case "tool_use_start":
          if (!s.bossStreaming) s.startBossAssistantMessage();
          s.addBossToolCall(chunk.toolUseId, chunk.toolName);
          break;
        case "tool_input_delta":
          s.appendBossToolInput(chunk.toolUseId, chunk.partialJson);
          break;
        case "tool_result":
          s.setBossToolResult(chunk.toolUseId, chunk.result, chunk.isError);
          break;
        case "notification":
          if (Notification.permission === "granted") {
            new Notification(chunk.title || "SmartTerm", { body: chunk.body });
          } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then((perm) => {
              if (perm === "granted") {
                new Notification(chunk.title || "SmartTerm", { body: chunk.body });
              }
            });
          }
          break;
        case "done":
          s.finishBossStreaming();
          break;
        case "error":
          if (!s.bossStreaming) s.startBossAssistantMessage();
          s.appendBossText(`\n\n**Error:** ${chunk.error}`);
          s.finishBossStreaming();
          break;
      }
    });

    socket.on("boss:error", ({ error }: { error: string }) => {
      const s = useTerminalStore.getState();
      if (!s.bossStreaming) s.startBossAssistantMessage();
      s.appendBossText(`**Error:** ${error}`);
      s.finishBossStreaming();
    });

    socket.on("boss:cleared", () => {
      useTerminalStore.getState().clearBossMessages();
    });

    return () => {
      socket.off("boss:chunk");
      socket.off("boss:error");
      socket.off("boss:cleared");
    };
  }, []);
}
