import { useMemo, useState } from "react";
import { useTerminalStore, type LayoutMode } from "../stores/terminalStore";
import { createTerminal } from "../hooks/useSocket";
import TerminalPanel from "./TerminalPanel";

function getGridStyle(layout: LayoutMode, count: number): React.CSSProperties {
  if (count === 0) return {};

  switch (layout) {
    case "single":
      return {
        gridTemplateColumns: "1fr",
        gridTemplateRows: "1fr",
      };

    case "cols-2":
      return {
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: count <= 2 ? "1fr" : `repeat(${Math.ceil(count / 2)}, 1fr)`,
      };

    case "cols-3":
      return {
        gridTemplateColumns: "1fr 1fr 1fr",
        gridTemplateRows: count <= 3 ? "1fr" : `repeat(${Math.ceil(count / 3)}, 1fr)`,
      };

    case "rows-2":
      return {
        gridTemplateColumns: count <= 2 ? "1fr" : `repeat(${Math.ceil(count / 2)}, 1fr)`,
        gridTemplateRows: "1fr 1fr",
      };

    case "grid-2x2":
      return {
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr 1fr",
      };

    case "main-side":
      if (count === 1) return { gridTemplateColumns: "1fr", gridTemplateRows: "1fr" };
      return {
        gridTemplateColumns: "2fr 1fr",
        gridTemplateRows: count <= 2 ? "1fr" : `repeat(${count - 1}, 1fr)`,
      };

    case "main-top":
      if (count === 1) return { gridTemplateColumns: "1fr", gridTemplateRows: "1fr" };
      return {
        gridTemplateColumns: count <= 2 ? "1fr" : `repeat(${count - 1}, 1fr)`,
        gridTemplateRows: "2fr 1fr",
      };

    case "auto":
    default:
      if (count === 1) return { gridTemplateColumns: "1fr", gridTemplateRows: "1fr" };
      if (count === 2) return { gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr" };
      if (count <= 4) return { gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr" };
      if (count <= 6) return { gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "1fr 1fr" };
      return {
        gridTemplateColumns: "1fr 1fr 1fr",
        gridTemplateRows: `repeat(${Math.ceil(count / 3)}, 1fr)`,
      };
  }
}

function getItemStyle(layout: LayoutMode, index: number, count: number): React.CSSProperties | undefined {
  // Main+Side: first terminal spans all rows in the left column
  if (layout === "main-side" && index === 0 && count > 1) {
    return { gridRow: `1 / ${count}`, gridColumn: "1" };
  }
  // Main+Top: first terminal spans all columns in the top row
  if (layout === "main-top" && index === 0 && count > 1) {
    return { gridRow: "1", gridColumn: `1 / ${count}` };
  }
  return undefined;
}

export default function TerminalGrid() {
  const terminals = useTerminalStore((s) => s.terminals);
  const order = useTerminalStore((s) => s.order);
  const maximizedId = useTerminalStore((s) => s.maximizedId);
  const minimizedIds = useTerminalStore((s) => s.minimizedIds);
  const toggleMinimized = useTerminalStore((s) => s.toggleMinimized);
  const reorder = useTerminalStore((s) => s.reorder);
  const layout = useTerminalStore((s) => s.layout);
  const focusedId = useTerminalStore((s) => s.focusedId);
  const setFocused = useTerminalStore((s) => s.setFocused);

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

  // Single layout: show only the focused terminal
  const displayTerminals = useMemo(() => {
    if (layout === "single" && visible.length > 0) {
      const focused = visible.find((t) => t.id === focusedId);
      return focused ? [focused] : [visible[0]];
    }
    return visible;
  }, [layout, visible, focusedId]);

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
      const fromId = displayTerminals[dragIdx]?.id;
      const toId = displayTerminals[idx]?.id;
      if (fromId && toId) {
        const fromOrder = order.indexOf(fromId);
        const toOrder = order.indexOf(toId);
        if (fromOrder >= 0 && toOrder >= 0) reorder(fromOrder, toOrder);
      }
    }
    setDragIdx(null);
    setOverIdx(null);
  };

  const gridStyle = getGridStyle(layout, displayTerminals.length);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-hidden p-1.5">
        {displayTerminals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
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
          <div className="grid gap-1.5 h-full" style={gridStyle}>
            {displayTerminals.map((t, i) => (
              <div
                key={t.id}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={() => handleDrop(i)}
                onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                className={`min-h-0 min-w-0 ${
                  dragIdx === i ? "opacity-40" : ""
                } ${overIdx === i && dragIdx !== i ? "ring-1 ring-terminal-accent/40 rounded-lg" : ""}`}
                style={getItemStyle(layout, i, displayTerminals.length)}
              >
                <TerminalPanel terminal={t} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Minimized dock + single-mode tabs */}
      {(minimized.length > 0 || (layout === "single" && visible.length > 1)) && (
        <div className="shrink-0 flex items-center gap-1 px-2 py-1 border-t border-terminal-border bg-terminal-surface/50 overflow-x-auto">
          {layout === "single" && visible.map((t) => (
            <button
              key={t.id}
              onClick={() => setFocused(t.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] transition-colors shrink-0 ${
                focusedId === t.id
                  ? "bg-terminal-accent/15 text-terminal-accent"
                  : "bg-terminal-border/40 text-terminal-dim hover:text-terminal-text"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${t.status === "running" ? "bg-terminal-green" : "bg-terminal-dim"}`} />
              {t.name}
            </button>
          ))}
          {minimized.length > 0 && layout === "single" && visible.length > 1 && (
            <div className="w-px h-4 bg-terminal-border mx-1" />
          )}
          {minimized.map((t) => (
            <button
              key={t.id}
              onClick={() => toggleMinimized(t.id)}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] bg-terminal-border/30 text-terminal-dim hover:text-terminal-text transition-colors shrink-0 opacity-60 hover:opacity-100"
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
