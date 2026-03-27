import { useTerminalStore } from "../stores/terminalStore";
import { createTerminal } from "../hooks/useSocket";

export default function TopBar() {
  const terminals = useTerminalStore((s) => s.terminals);
  const bookmarkOpen = useTerminalStore((s) => s.bookmarkOpen);
  const setBookmarkOpen = useTerminalStore((s) => s.setBookmarkOpen);
  const bossPanelOpen = useTerminalStore((s) => s.bossPanelOpen);
  const setBossPanelOpen = useTerminalStore((s) => s.setBossPanelOpen);
  const zoom = useTerminalStore((s) => s.zoom);
  const setZoom = useTerminalStore((s) => s.setZoom);
  const setSettingsOpen = useTerminalStore((s) => s.setSettingsOpen);

  const running = terminals.filter((t) => t.status === "running").length;
  const isElectron = !!window.smartterm?.isElectron;

  return (
    <header
      className="h-10 flex items-center justify-between pl-3 bg-terminal-surface border-b border-terminal-border shrink-0"
      style={{ WebkitAppRegion: "drag", paddingRight: isElectron ? 150 : 12 } as React.CSSProperties}
    >
      <div className="flex items-center gap-2.5" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <button
          onClick={() => setBookmarkOpen(!bookmarkOpen)}
          className={`p-1 rounded transition-colors ${
            bookmarkOpen ? "text-terminal-accent" : "text-terminal-dim hover:text-terminal-text"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <span className="text-terminal-accent font-bold text-sm tracking-wide select-none">SmartTerm</span>
        <span className="text-[11px] text-terminal-dim select-none">
          <span className="text-terminal-green font-medium">{running}</span>
          <span className="mx-0.5">/</span>{terminals.length}
        </span>
      </div>

      {/* Zoom */}
      <div className="flex items-center gap-0.5" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <button onClick={() => setZoom(zoom - 1)} className="w-5 h-5 flex items-center justify-center rounded text-terminal-dim hover:text-terminal-text text-xs">−</button>
        <span className="text-[10px] text-terminal-dim w-5 text-center select-none">{zoom}</span>
        <button onClick={() => setZoom(zoom + 1)} className="w-5 h-5 flex items-center justify-center rounded text-terminal-dim hover:text-terminal-text text-xs">+</button>
      </div>

      <div className="flex items-center gap-2" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <button onClick={() => createTerminal()} className="btn-primary text-xs py-1">
          + New
        </button>
        <button
          onClick={() => setBossPanelOpen(!bossPanelOpen)}
          className={`px-2 py-1 rounded text-xs transition-colors ${
            bossPanelOpen
              ? "bg-terminal-purple/20 text-terminal-purple border border-terminal-purple/30"
              : "text-terminal-dim hover:text-terminal-text"
          }`}
        >
          Boss
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className="p-1 rounded text-terminal-dim hover:text-terminal-text transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
        </button>
      </div>
    </header>
  );
}
