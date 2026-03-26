import { useState, useCallback } from "react";
import { useTerminal } from "../hooks/useTerminal";
import { useTerminalStore, type TerminalInfo } from "../stores/terminalStore";
import { removeTerminal, renameTerminal } from "../hooks/useSocket";

export default function TerminalPanel({ terminal }: { terminal: TerminalInfo }) {
  const focusedId = useTerminalStore((s) => s.focusedId);
  const maximizedId = useTerminalStore((s) => s.maximizedId);
  const setFocused = useTerminalStore((s) => s.setFocused);
  const setMaximized = useTerminalStore((s) => s.setMaximized);
  const toggleMinimized = useTerminalStore((s) => s.toggleMinimized);

  const isFocused = focusedId === terminal.id;
  const isMaximized = maximizedId === terminal.id;

  const { containerRef, focus } = useTerminal(terminal.id);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(terminal.name);
  const [confirmClose, setConfirmClose] = useState(false);

  const handleFocus = useCallback(() => {
    setFocused(terminal.id);
    focus();
  }, [terminal.id, setFocused, focus]);

  const handleClose = useCallback(() => {
    if (terminal.status === "running" && !confirmClose) {
      setConfirmClose(true);
      setTimeout(() => setConfirmClose(false), 2000);
      return;
    }
    removeTerminal(terminal.id);
  }, [terminal.id, terminal.status, confirmClose]);

  const handleRename = useCallback(() => {
    if (editName.trim() && editName !== terminal.name) {
      renameTerminal(terminal.id, editName.trim());
    }
    setEditing(false);
  }, [terminal.id, terminal.name, editName]);

  return (
    <div
      onClick={handleFocus}
      className={`flex flex-col h-full rounded-lg border overflow-hidden transition-colors ${
        isFocused
          ? "border-terminal-accent/50"
          : "border-terminal-border"
      }`}
    >
      {/* Header */}
      <div className="h-7 flex items-center justify-between px-2 bg-terminal-surface shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              terminal.status === "running" ? "bg-terminal-green" : "bg-terminal-dim"
            }`}
          />
          {editing ? (
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              className="bg-transparent text-xs text-terminal-text outline-none border-b border-terminal-accent/50 w-full"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              onDoubleClick={() => { setEditName(terminal.name); setEditing(true); }}
              className="text-xs text-terminal-text truncate cursor-default"
            >
              {terminal.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); toggleMinimized(terminal.id); }}
            className="w-5 h-5 flex items-center justify-center text-terminal-dim hover:text-terminal-text rounded"
          >
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="2" y1="6" x2="10" y2="6" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setMaximized(isMaximized ? null : terminal.id); }}
            className="w-5 h-5 flex items-center justify-center text-terminal-dim hover:text-terminal-text rounded"
          >
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2" width="8" height="8" rx="1" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleClose(); }}
            className={`w-5 h-5 flex items-center justify-center rounded ${
              confirmClose ? "text-terminal-red" : "text-terminal-dim hover:text-terminal-red"
            }`}
          >
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="3" y1="3" x2="9" y2="9" />
              <line x1="9" y1="3" x2="3" y2="9" />
            </svg>
          </button>
        </div>
      </div>

      {/* Terminal */}
      <div
        ref={containerRef}
        onClick={(e) => { e.stopPropagation(); focus(); }}
        className="flex-1"
        style={{ background: "#0a0e14" }}
      />
    </div>
  );
}
