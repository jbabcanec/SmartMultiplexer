import { useTerminalStore } from "../stores/terminalStore";
import { createTerminal, getSocket } from "../hooks/useSocket";

export default function TopBar() {
  const terminals = useTerminalStore((s) => s.terminals);
  const bookmarkOpen = useTerminalStore((s) => s.bookmarkOpen);
  const setBookmarkOpen = useTerminalStore((s) => s.setBookmarkOpen);
  const bossPanelOpen = useTerminalStore((s) => s.bossPanelOpen);
  const setBossPanelOpen = useTerminalStore((s) => s.setBossPanelOpen);
  const bossTerminalId = useTerminalStore((s) => s.bossTerminalId);
  const setBossTerminalId = useTerminalStore((s) => s.setBossTerminalId);
  const zoom = useTerminalStore((s) => s.zoom);
  const setZoom = useTerminalStore((s) => s.setZoom);

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
        <button
          onClick={() => {
            const opening = !bossPanelOpen;
            setBossPanelOpen(opening);
            // Spawn boss terminal if opening and none exists
            if (opening && !bossTerminalId) {
              getSocket().emit("boss:spawn", (res: { ok: boolean; id?: string }) => {
                if (res?.ok && res.id) setBossTerminalId(res.id);
              });
            }
          }}
          className={`px-2 py-1 rounded text-xs transition-colors ${
            bossPanelOpen
              ? "bg-terminal-purple/20 text-terminal-purple border border-terminal-purple/30"
              : "text-terminal-dim hover:text-terminal-text"
          }`}
        >
          Boss
        </button>
        <button onClick={() => createTerminal()} className="btn-primary text-xs py-1">
          + New
        </button>
      </div>
    </header>
  );
}
