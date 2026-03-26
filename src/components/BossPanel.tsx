import { useRef, useState, useEffect } from "react";
import { useTerminalStore } from "../stores/terminalStore";
import { useBossStore } from "../stores/bossStore";
import { sendBossMessage } from "../hooks/useSocket";

export default function BossPanel() {
  const open = useTerminalStore((s) => s.bossPanelOpen);
  const messages = useBossStore((s) => s.messages);
  const isThinking = useBossStore((s) => s.isThinking);
  const streamingText = useBossStore((s) => s.streamingText);

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText]);

  if (!open) return null;

  const handleSend = () => {
    const text = input.trim();
    if (!text || isThinking) return;
    setInput("");
    sendBossMessage(text);
  };

  return (
    <div className="w-80 shrink-0 flex flex-col border-l border-terminal-border bg-terminal-surface/80 backdrop-blur-sm">
      {/* Header */}
      <div className="h-8 flex items-center px-3 border-b border-terminal-border shrink-0">
        <span className="text-xs font-medium text-terminal-purple">Boss Agent</span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && !streamingText && (
          <div className="text-terminal-dim text-xs text-center py-4">
            Ask the boss about your terminals.
            <br />
            <span className="text-[10px] italic mt-1 block">
              "which terminal is working on my API?" or "tell terminal 2 to run tests"
            </span>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`text-xs ${
              msg.role === "user"
                ? "text-terminal-text ml-4"
                : "text-terminal-dim mr-4"
            }`}
          >
            <div
              className={`rounded-lg px-3 py-2 ${
                msg.role === "user"
                  ? "bg-terminal-accent/10 border border-terminal-accent/20"
                  : "bg-terminal-border/50"
              }`}
            >
              <pre className="whitespace-pre-wrap font-mono">{msg.content}</pre>
            </div>
          </div>
        ))}

        {streamingText && (
          <div className="text-xs text-terminal-dim mr-4">
            <div className="rounded-lg px-3 py-2 bg-terminal-border/50">
              <pre className="whitespace-pre-wrap font-mono">
                {streamingText}
                <span className="animate-pulse">|</span>
              </pre>
            </div>
          </div>
        )}

        {isThinking && !streamingText && (
          <div className="text-xs text-terminal-purple animate-pulse">Thinking...</div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 p-2 border-t border-terminal-border">
        <div className="flex gap-1.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask the boss..."
            className="input-field text-xs flex-1"
            disabled={isThinking}
          />
          <button
            onClick={handleSend}
            disabled={isThinking || !input.trim()}
            className="btn-primary text-xs px-2 py-1"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
