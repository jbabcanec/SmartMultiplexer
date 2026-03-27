import { useMemo, useState } from "react";
import { useTerminalStore } from "../stores/terminalStore";
import { createTerminal } from "../hooks/useSocket";
import TerminalPanel from "./TerminalPanel";

export default function TerminalGrid() {
  const terminals = useTerminalStore((s) => s.terminals);
  const order = useTerminalStore((s) => s.order);
  const maximizedId = useTerminalStore((s) => s.maximizedId);
  const minimizedIds = useTerminalStore((s) => s.minimizedIds);
  const toggleMinimized = useTerminalStore((s) => s.toggleMinimized);
  const reorder = useTerminalStore((s) => s.reorder);

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const ordered = useMemo(() => {
    return order
      .map((id) => terminals.find((t) => t.id === id))
      .filter((t): t is NonNullable<typeof t> => t != null);
  }, [terminals, order]);

  const visible = useMemo(
    () => ordered.filter((t) => !minimizedIds.includes(t.id)),
    [ordered, minimizedIds]
  );

  const minimized = useMemo(
    () => ordered.filter((t) => minimizedIds.includes(t.id)),
    [ordered, minimizedIds]
  );

  // Maximized — single terminal fills everything
  if (maximizedId) {
    const term = terminals.find((t) => t.id === maximizedId);
    if (term) {
      return (
        <div className="flex-1 flex flex-col overflow-hidden p-1">
          <TerminalPanel terminal={term} />
        </div>
      );
    }
  }

  // Figure out columns: 1 for 1, 2 for 2-4, 3 for 5+
  const cols = visible.length <= 1 ? 1 : visible.length <= 4 ? 2 : 3;
  const rows = Math.ceil(visible.length / cols);

  const handleDrop = (idx: number) => {
    if (dragIdx !== null && dragIdx !== idx) {
      const fromId = visible[dragIdx]?.id;
      const toId = visible[idx]?.id;
      if (fromId && toId) {
        const f = order.indexOf(fromId);
        const t = order.indexOf(toId);
        if (f >= 0 && t >= 0) reorder(f, t);
      }
    }
    setDragIdx(null);
    setOverIdx(null);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Grid */}
      <div className="flex-1 overflow-hidden p-1">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="text-terminal-dim text-sm mb-3">
              {terminals.length === 0 ? "No terminals" : "All minimized"}
            </div>
            {terminals.length === 0 && (
              <button onClick={() => createTerminal()} className="btn-primary text-xs">
                + New Terminal
              </button>
            )}
          </div>
        ) : (
          <div
            className="grid gap-1 h-full"
            style={{
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gridTemplateRows: `repeat(${rows}, 1fr)`,
            }}
          >
            {visible.map((t, i) => (
              <div
                key={t.id}
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => { e.preventDefault(); setOverIdx(i); }}
                onDrop={() => handleDrop(i)}
                onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                className={`min-h-0 min-w-0 overflow-hidden ${
                  dragIdx === i ? "opacity-40" : ""
                } ${overIdx === i && dragIdx !== i ? "ring-1 ring-terminal-accent/40 rounded-lg" : ""}`}
              >
                <TerminalPanel terminal={t} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Minimized dock */}
      {minimized.length > 0 && (
        <div className="shrink-0 flex items-center gap-1 px-2 py-1 border-t border-terminal-border bg-terminal-surface/50 overflow-x-auto">
          {minimized.map((t) => (
            <button
              key={t.id}
              onClick={() => toggleMinimized(t.id)}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] bg-terminal-border/30 text-terminal-dim hover:text-terminal-text transition-colors shrink-0"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${t.status === "running" ? "bg-terminal-green" : "bg-terminal-dim"}`} />
              {t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
