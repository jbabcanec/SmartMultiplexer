import { useMemo, useRef, useState } from "react";
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

  const visible = useMemo(() => {
    return ordered.filter((t) => !minimizedIds.includes(t.id));
  }, [ordered, minimizedIds]);

  const minimized = useMemo(() => {
    return ordered.filter((t) => minimizedIds.includes(t.id));
  }, [ordered, minimizedIds]);

  // Maximized view
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

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setOverIdx(idx);
  };
  const handleDrop = (idx: number) => {
    if (dragIdx !== null && dragIdx !== idx) {
      // Map visible indices back to order indices
      const fromId = visible[dragIdx]?.id;
      const toId = visible[idx]?.id;
      if (fromId && toId) {
        const fromOrder = order.indexOf(fromId);
        const toOrder = order.indexOf(toId);
        if (fromOrder >= 0 && toOrder >= 0) reorder(fromOrder, toOrder);
      }
    }
    setDragIdx(null);
    setOverIdx(null);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-2">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-terminal-dim text-sm mb-3">
              {terminals.length === 0 ? "No terminals" : "All minimized"}
            </div>
            {terminals.length === 0 && (
              <button onClick={() => createTerminal()} className="btn-primary text-xs">
                + Open Terminal
              </button>
            )}
          </div>
        ) : (
          <div
            className="grid gap-2 h-full"
            style={{
              gridTemplateColumns:
                visible.length === 1
                  ? "1fr"
                  : visible.length <= 4
                  ? "repeat(2, 1fr)"
                  : "repeat(auto-fill, minmax(480px, 1fr))",
              gridTemplateRows:
                visible.length <= 2
                  ? "1fr"
                  : visible.length <= 4
                  ? "repeat(2, 1fr)"
                  : "auto",
            }}
          >
            {visible.map((t, i) => (
              <div
                key={t.id}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={() => handleDrop(i)}
                onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                className={`transition-opacity ${
                  dragIdx === i ? "opacity-50" : ""
                } ${overIdx === i && dragIdx !== i ? "ring-1 ring-terminal-accent/50 rounded-lg" : ""}`}
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
              className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] bg-terminal-border/50 text-terminal-dim hover:text-terminal-text transition-colors shrink-0"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  t.status === "running" ? "bg-terminal-green" : "bg-terminal-dim"
                }`}
              />
              {t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
