import { useCallback, useEffect, useRef, useState } from "react";
import { useTerminalStore, type BossMessage, type BossToolCall } from "../stores/terminalStore";
import { getSocket } from "../hooks/useSocket";

// --- Simple markdown-ish rendering ---

function renderContent(text: string) {
  if (!text) return null;

  // Split by code blocks first
  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts.map((part, i) => {
    // Code block
    if (part.startsWith("```")) {
      const lines = part.slice(3, -3);
      const firstNewline = lines.indexOf("\n");
      const code = firstNewline >= 0 ? lines.slice(firstNewline + 1) : lines;
      return (
        <pre
          key={i}
          className="bg-terminal-bg rounded px-2.5 py-2 my-1.5 text-[11px] leading-relaxed overflow-x-auto border border-terminal-border/50"
        >
          <code>{code}</code>
        </pre>
      );
    }

    // Inline formatting
    return (
      <span key={i} className="whitespace-pre-wrap">
        {part.split(/(`[^`]+`)/g).map((seg, j) =>
          seg.startsWith("`") && seg.endsWith("`") ? (
            <code
              key={j}
              className="bg-terminal-bg/80 text-terminal-accent px-1 py-0.5 rounded text-[11px]"
            >
              {seg.slice(1, -1)}
            </code>
          ) : (
            // Bold
            seg.split(/(\*\*[^*]+\*\*)/g).map((s, k) =>
              s.startsWith("**") && s.endsWith("**") ? (
                <strong key={k} className="text-terminal-text font-semibold">
                  {s.slice(2, -2)}
                </strong>
              ) : (
                <span key={k}>{s}</span>
              )
            )
          )
        )}
      </span>
    );
  });
}

// --- Tool call card ---

function ToolCallCard({ tc }: { tc: BossToolCall }) {
  const [expanded, setExpanded] = useState(false);

  const statusColor =
    tc.status === "running"
      ? "bg-terminal-yellow"
      : tc.isError
        ? "bg-terminal-red"
        : "bg-terminal-green";

  let parsedInput = tc.input;
  try {
    const obj = JSON.parse(tc.input);
    parsedInput = JSON.stringify(obj, null, 2);
  } catch {}

  return (
    <div className="border border-terminal-border/50 rounded-md my-1.5 overflow-hidden bg-terminal-bg/30">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-terminal-surface/50 transition-colors"
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusColor} ${tc.status === "running" ? "animate-pulse" : ""}`} />
        <span className="text-[11px] font-mono text-terminal-dim flex-1 truncate">
          {tc.name}
        </span>
        <svg
          className={`w-3 h-3 text-terminal-dim transition-transform ${expanded ? "rotate-180" : ""}`}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <polyline points="3,4 6,7 9,4" />
        </svg>
      </button>
      {expanded && (
        <div className="border-t border-terminal-border/30 px-2.5 py-1.5 space-y-1">
          {tc.input && (
            <pre className="text-[10px] text-terminal-dim font-mono whitespace-pre-wrap break-all">
              {parsedInput}
            </pre>
          )}
          {tc.result && (
            <pre
              className={`text-[10px] font-mono whitespace-pre-wrap break-all mt-1 max-h-40 overflow-y-auto ${
                tc.isError ? "text-terminal-red" : "text-terminal-green/80"
              }`}
            >
              {tc.result.length > 2000 ? tc.result.slice(0, 2000) + "\n... (truncated)" : tc.result}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// --- Message bubble ---

function MessageBubble({ msg }: { msg: BossMessage }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-terminal-purple/10 border border-terminal-purple/20 rounded-lg px-3 py-2 text-sm text-terminal-text">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[95%]">
      <div className="text-sm text-terminal-text">{renderContent(msg.content)}</div>
      {msg.toolCalls?.map((tc) => <ToolCallCard key={tc.id} tc={tc} />)}
    </div>
  );
}

// --- Main chat component ---

export default function BossChat() {
  const open = useTerminalStore((s) => s.bossPanelOpen);
  const messages = useTerminalStore((s) => s.bossMessages);
  const streaming = useTerminalStore((s) => s.bossStreaming);
  const setBossPanelOpen = useTerminalStore((s) => s.setBossPanelOpen);
  const addBossUserMessage = useTerminalStore((s) => s.addBossUserMessage);
  const startBossAssistantMessage = useTerminalStore((s) => s.startBossAssistantMessage);

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new content
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 96) + "px";
    }
  }, [input]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    addBossUserMessage(text);
    startBossAssistantMessage();
    getSocket().emit("boss:message", { text });
  }, [input, streaming, addBossUserMessage, startBossAssistantMessage]);

  const handleAbort = useCallback(() => {
    getSocket().emit("boss:abort");
  }, []);

  const handleClear = useCallback(() => {
    getSocket().emit("boss:clear");
  }, []);

  const handleClose = useCallback(() => {
    setBossPanelOpen(false);
  }, [setBossPanelOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  if (!open) return null;

  return (
    <div className="w-[480px] shrink-0 flex flex-col border-l border-terminal-border bg-terminal-surface/80">
      {/* Header */}
      <div className="h-8 flex items-center justify-between px-3 border-b border-terminal-border shrink-0 bg-terminal-surface">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-terminal-purple" />
          <span className="text-[11px] font-medium text-terminal-purple">Boss AI</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              className="px-1.5 py-0.5 rounded text-[10px] text-terminal-dim hover:text-terminal-text transition-colors"
            >
              Clear
            </button>
          )}
          <button
            onClick={handleClose}
            className="w-5 h-5 flex items-center justify-center text-terminal-dim hover:text-terminal-red rounded"
          >
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="3" y1="3" x2="9" y2="9" />
              <line x1="9" y1="3" x2="3" y2="9" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center h-full text-center px-4">
            <div className="text-terminal-purple/60 text-2xl mb-2">Boss</div>
            <p className="text-xs text-terminal-dim leading-relaxed">
              Ask me about your terminals, or tell me what to work on.
              I can monitor processes, send commands, and spawn Claude Code workers.
            </p>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
        )}
        {streaming && messages[messages.length - 1]?.content === "" && !messages[messages.length - 1]?.toolCalls?.length && (
          <div className="flex items-center gap-1 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-terminal-purple animate-pulse" />
            <span className="text-[11px] text-terminal-dim">Thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-terminal-border p-2">
        <div className="flex items-end gap-1.5">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Boss..."
            rows={1}
            className="flex-1 bg-terminal-bg border border-terminal-border rounded-md px-2.5 py-1.5 text-sm text-terminal-text placeholder:text-terminal-dim/50 outline-none focus:border-terminal-purple/50 resize-none font-mono"
            disabled={streaming}
          />
          {streaming ? (
            <button
              onClick={handleAbort}
              className="shrink-0 px-2.5 py-1.5 rounded-md text-xs bg-terminal-red/20 text-terminal-red hover:bg-terminal-red/30 transition-colors"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="shrink-0 px-2.5 py-1.5 rounded-md text-xs bg-terminal-purple/20 text-terminal-purple hover:bg-terminal-purple/30 disabled:opacity-30 transition-colors"
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
