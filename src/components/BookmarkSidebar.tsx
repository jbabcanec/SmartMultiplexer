import { useState } from "react";
import { useTerminalStore, getSessions, saveSession, deleteSession, type Session } from "../stores/terminalStore";
import { createTerminal, removeAllTerminals } from "../hooks/useSocket";

export default function BookmarkSidebar() {
  const open = useTerminalStore((s) => s.bookmarkOpen);
  const terminals = useTerminalStore((s) => s.terminals);
  const lastLines = useTerminalStore((s) => s.lastLines);
  const focusedId = useTerminalStore((s) => s.focusedId);
  const minimizedIds = useTerminalStore((s) => s.minimizedIds);
  const setFocused = useTerminalStore((s) => s.setFocused);
  const setMaximized = useTerminalStore((s) => s.setMaximized);
  const toggleMinimized = useTerminalStore((s) => s.toggleMinimized);

  const [sessionName, setSessionName] = useState("");
  const [showSessions, setShowSessions] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);

  if (!open) return null;

  const handleSaveSession = () => {
    if (!sessionName.trim()) return;
    saveSession({
      name: sessionName.trim(),
      terminals: terminals.map((t) => ({
        name: t.name,
        cwd: t.cwd,
        groupName: t.groupName,
      })),
      savedAt: Date.now(),
    });
    setSessionName("");
    setSessions(getSessions());
  };

  const handleLoadSession = (session: Session) => {
    session.terminals.forEach((t) => {
      createTerminal({ name: t.name, cwd: t.cwd, groupName: t.groupName || undefined });
    });
    setShowSessions(false);
  };

  const handleDeleteSession = (name: string) => {
    deleteSession(name);
    setSessions(getSessions());
  };

  const handleClearAll = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 2000);
      return;
    }
    removeAllTerminals();
    setConfirmClear(false);
  };

  return (
    <aside className="w-52 shrink-0 flex flex-col border-r border-terminal-border bg-terminal-surface/50 overflow-hidden">
      {/* Terminals list */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          <div className="text-[10px] uppercase tracking-wider text-terminal-dim mb-2 px-1 font-medium">
            Terminals
          </div>
          {terminals.length === 0 && (
            <div className="text-[11px] text-terminal-dim px-1 py-2">None open</div>
          )}
          {terminals.map((t) => {
            const isMin = minimizedIds.includes(t.id);
            return (
              <button
                key={t.id}
                onClick={() => {
                  if (isMin) toggleMinimized(t.id);
                  setFocused(t.id);
                  setMaximized(null);
                }}
                onDoubleClick={() => setMaximized(t.id)}
                className={`w-full text-left px-2 py-1.5 rounded mb-0.5 transition-colors ${
                  focusedId === t.id
                    ? "bg-terminal-accent/10 text-terminal-accent"
                    : "text-terminal-text hover:bg-terminal-border/30"
                } ${isMin ? "opacity-50" : ""}`}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      t.status === "running" ? "bg-terminal-green" : "bg-terminal-dim"
                    }`}
                  />
                  <span className="text-xs truncate">{t.name}</span>
                </div>
                {lastLines[t.id] && (
                  <div className="text-[10px] text-terminal-dim truncate mt-0.5 pl-3">
                    {lastLines[t.id]}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Session controls */}
      <div className="shrink-0 border-t border-terminal-border p-2 space-y-1.5">
        {/* Save session */}
        <div className="flex gap-1">
          <input
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSaveSession()}
            placeholder="Session name..."
            className="input-field text-[11px] py-1 flex-1"
          />
          <button
            onClick={handleSaveSession}
            disabled={!sessionName.trim()}
            className="text-[11px] px-1.5 py-1 rounded text-terminal-dim hover:text-terminal-accent disabled:opacity-30 transition-colors"
            title="Save session"
          >
            Save
          </button>
        </div>

        {/* Load / manage sessions */}
        <button
          onClick={() => {
            setSessions(getSessions());
            setShowSessions(!showSessions);
          }}
          className="w-full text-[11px] text-terminal-dim hover:text-terminal-text text-left px-1 transition-colors"
        >
          {showSessions ? "Hide sessions" : `Sessions (${getSessions().length})`}
        </button>

        {showSessions && (
          <div className="space-y-0.5 max-h-32 overflow-y-auto">
            {sessions.length === 0 && (
              <div className="text-[10px] text-terminal-dim px-1">No saved sessions</div>
            )}
            {sessions.map((s) => (
              <div key={s.name} className="flex items-center gap-1">
                <button
                  onClick={() => handleLoadSession(s)}
                  className="flex-1 text-left text-[11px] px-1.5 py-1 rounded text-terminal-text hover:bg-terminal-accent/10 hover:text-terminal-accent transition-colors truncate"
                  title={`${s.terminals.length} terminals — ${new Date(s.savedAt).toLocaleDateString()}`}
                >
                  {s.name}
                  <span className="text-terminal-dim ml-1">({s.terminals.length})</span>
                </button>
                <button
                  onClick={() => handleDeleteSession(s.name)}
                  className="text-terminal-dim hover:text-terminal-red text-[11px] px-1 shrink-0"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Clear all */}
        {terminals.length > 0 && (
          <button
            onClick={handleClearAll}
            className={`w-full text-[11px] py-1 rounded transition-colors ${
              confirmClear
                ? "bg-terminal-red/20 text-terminal-red"
                : "text-terminal-dim hover:text-terminal-red"
            }`}
          >
            {confirmClear ? "Confirm clear all?" : "Clear all"}
          </button>
        )}
      </div>
    </aside>
  );
}
