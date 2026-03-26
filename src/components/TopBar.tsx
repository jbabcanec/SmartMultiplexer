import { useTerminalStore } from "../stores/terminalStore";
import { createTerminal } from "../hooks/useSocket";

export default function TopBar() {
  const terminals = useTerminalStore((s) => s.terminals);
  const bookmarkOpen = useTerminalStore((s) => s.bookmarkOpen);
  const setBookmarkOpen = useTerminalStore((s) => s.setBookmarkOpen);
  const bossPanelOpen = useTerminalStore((s) => s.bossPanelOpen);
  const setBossPanelOpen = useTerminalStore((s) => s.setBossPanelOpen);

  const running = terminals.filter((t) => t.status === "running").length;

  return (
    <header className="h-11 flex items-center justify-between px-4 bg-terminal-surface border-b border-terminal-border shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setBookmarkOpen(!bookmarkOpen)}
          className={`px-2 py-1 rounded text-xs transition-colors ${
            bookmarkOpen
              ? "bg-terminal-accent/10 text-terminal-accent"
              : "text-terminal-dim hover:text-terminal-text hover:bg-terminal-border/50"
          }`}
          title="Toggle sidebar"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <h1 className="text-terminal-accent font-bold text-sm tracking-wide">SmartTerm</h1>
        <span className="text-[11px] text-terminal-dim">
          <span className="text-terminal-green font-medium">{running}</span>
          {" / "}
          {terminals.length}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setBossPanelOpen(!bossPanelOpen)}
          className={`px-3 py-1 rounded text-xs transition-colors ${
            bossPanelOpen
              ? "bg-terminal-purple/20 text-terminal-purple border border-terminal-purple/30"
              : "text-terminal-dim hover:text-terminal-text hover:bg-terminal-border/50"
          }`}
        >
          Boss
        </button>
        <button
          onClick={() => createTerminal()}
          className="btn-primary text-xs py-1"
        >
          + New
        </button>
      </div>
    </header>
  );
}
