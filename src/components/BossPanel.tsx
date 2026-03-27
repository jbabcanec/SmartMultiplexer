import { useCallback } from "react";
import { useTerminalStore } from "../stores/terminalStore";
import { useTerminal } from "../hooks/useTerminal";
import { getSocket } from "../hooks/useSocket";

export default function BossPanel() {
  const open = useTerminalStore((s) => s.bossPanelOpen);
  const bossId = useTerminalStore((s) => s.bossTerminalId);
  const setBossPanelOpen = useTerminalStore((s) => s.setBossPanelOpen);

  const { containerRef, focus } = useTerminal(open && bossId ? bossId : null);

  const handleRefresh = useCallback(() => {
    if (bossId) {
      getSocket().emit("boss:refresh", { bossId });
    }
  }, [bossId]);

  const handleClose = useCallback(() => {
    setBossPanelOpen(false);
  }, [setBossPanelOpen]);

  if (!open) return null;

  return (
    <div className="w-[480px] shrink-0 flex flex-col border-l border-terminal-border bg-terminal-surface/80">
      {/* Header */}
      <div className="h-8 flex items-center justify-between px-3 border-b border-terminal-border shrink-0 bg-terminal-surface">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${bossId ? "bg-terminal-purple" : "bg-terminal-dim/40"}`} />
          <span className="text-[11px] font-medium text-terminal-purple">Boss AI</span>
        </div>
        <div className="flex items-center gap-1">
          {bossId && (
            <button
              onClick={handleRefresh}
              className="px-1.5 py-0.5 rounded text-[10px] text-terminal-dim hover:text-terminal-purple transition-colors"
              title="Refresh terminal context"
            >
              Refresh
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

      {/* Boss AI terminal */}
      {!bossId ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-terminal-dim text-xs">Starting Claude session...</span>
        </div>
      ) : (
        <div
          ref={containerRef}
          onClick={() => focus()}
          className="flex-1"
          style={{ background: "#0a0e14" }}
        />
      )}
    </div>
  );
}
