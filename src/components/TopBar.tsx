import { useState } from "react";
import { useTerminalStore, type LayoutMode } from "../stores/terminalStore";
import { createTerminal } from "../hooks/useSocket";

const LAYOUTS: { mode: LayoutMode; label: string; icon: string }[] = [
  { mode: "auto",      label: "Auto",        icon: "⊞" },
  { mode: "single",    label: "Single",      icon: "□" },
  { mode: "cols-2",    label: "2 Columns",   icon: "▮▮" },
  { mode: "cols-3",    label: "3 Columns",   icon: "▮▮▮" },
  { mode: "rows-2",    label: "2 Rows",      icon: "▬▬" },
  { mode: "grid-2x2",  label: "2×2 Grid",   icon: "⊞" },
  { mode: "main-side", label: "Main + Side", icon: "▮▯" },
  { mode: "main-top",  label: "Main + Row",  icon: "▬▯" },
];

export default function TopBar() {
  const terminals = useTerminalStore((s) => s.terminals);
  const bookmarkOpen = useTerminalStore((s) => s.bookmarkOpen);
  const setBookmarkOpen = useTerminalStore((s) => s.setBookmarkOpen);
  const bossPanelOpen = useTerminalStore((s) => s.bossPanelOpen);
  const setBossPanelOpen = useTerminalStore((s) => s.setBossPanelOpen);
  const layout = useTerminalStore((s) => s.layout);
  const setLayout = useTerminalStore((s) => s.setLayout);
  const zoom = useTerminalStore((s) => s.zoom);
  const setZoom = useTerminalStore((s) => s.setZoom);

  const [showLayouts, setShowLayouts] = useState(false);

  const running = terminals.filter((t) => t.status === "running").length;
  const isElectron = !!window.smartterm?.isElectron;

  return (
    <header
      className="h-11 flex items-center justify-between pl-3 bg-terminal-surface border-b border-terminal-border shrink-0"
      style={{ WebkitAppRegion: "drag", paddingRight: isElectron ? 150 : 12 } as React.CSSProperties}
    >
      {/* Left */}
      <div className="flex items-center gap-2" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <button
          onClick={() => setBookmarkOpen(!bookmarkOpen)}
          className={`p-1.5 rounded transition-colors ${
            bookmarkOpen
              ? "bg-terminal-accent/10 text-terminal-accent"
              : "text-terminal-dim hover:text-terminal-text hover:bg-terminal-border/50"
          }`}
          title="Toggle sidebar (Ctrl+\\)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>

        <h1 className="text-terminal-accent font-bold text-sm tracking-wide select-none">SmartTerm</h1>

        <span className="text-[11px] text-terminal-dim select-none">
          <span className="text-terminal-green font-medium">{running}</span>
          <span className="text-terminal-border mx-0.5">/</span>
          {terminals.length}
        </span>
      </div>

      {/* Center — Layout + Zoom */}
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        {/* Layout picker */}
        <div className="relative">
          <button
            onClick={() => setShowLayouts(!showLayouts)}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-terminal-dim hover:text-terminal-text hover:bg-terminal-border/50 transition-colors"
            title="Layout"
          >
            <span className="text-sm leading-none">{LAYOUTS.find((l) => l.mode === layout)?.icon}</span>
            <span className="hidden sm:inline">{LAYOUTS.find((l) => l.mode === layout)?.label}</span>
          </button>

          {showLayouts && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowLayouts(false)} />
              <div className="absolute top-full left-0 mt-1 z-50 glass-panel p-1 min-w-[140px]">
                {LAYOUTS.map((l) => (
                  <button
                    key={l.mode}
                    onClick={() => { setLayout(l.mode); setShowLayouts(false); }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[11px] transition-colors ${
                      layout === l.mode
                        ? "bg-terminal-accent/10 text-terminal-accent"
                        : "text-terminal-dim hover:text-terminal-text hover:bg-terminal-border/30"
                    }`}
                  >
                    <span className="text-sm w-5 text-center">{l.icon}</span>
                    <span>{l.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-0.5 ml-1">
          <button
            onClick={() => setZoom(zoom - 1)}
            className="w-6 h-6 flex items-center justify-center rounded text-terminal-dim hover:text-terminal-text hover:bg-terminal-border/50 text-xs transition-colors"
            title="Zoom out"
          >
            −
          </button>
          <span className="text-[10px] text-terminal-dim w-6 text-center select-none">{zoom}</span>
          <button
            onClick={() => setZoom(zoom + 1)}
            className="w-6 h-6 flex items-center justify-center rounded text-terminal-dim hover:text-terminal-text hover:bg-terminal-border/50 text-xs transition-colors"
            title="Zoom in"
          >
            +
          </button>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <button
          onClick={() => setBossPanelOpen(!bossPanelOpen)}
          className={`px-2.5 py-1 rounded text-xs transition-colors ${
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
