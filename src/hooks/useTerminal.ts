import { useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { getSocket } from "./useSocket";
import { useTerminalStore } from "../stores/terminalStore";

export function useTerminal(
  containerRef: React.RefObject<HTMLDivElement | null>,
  terminalId: string | null,
  active: boolean
) {
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const zoom = useTerminalStore((s) => s.zoom);

  const focus = useCallback(() => {
    termRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!containerRef.current || !terminalId || !active) return;

    const socket = getSocket();
    const term = new Terminal({
      theme: {
        background: "#0a0e14",
        foreground: "#c5cdd9",
        cursor: "#39bae6",
        selectionBackground: "rgba(57, 186, 230, 0.3)",
        black: "#0a0e14",
        red: "#ff6b6b",
        green: "#7fd962",
        yellow: "#ffb454",
        blue: "#39bae6",
        magenta: "#c792ea",
        cyan: "#39bae6",
        white: "#c5cdd9",
        brightBlack: "#6b7a8d",
        brightRed: "#ff6b6b",
        brightGreen: "#7fd962",
        brightYellow: "#ffb454",
        brightBlue: "#39bae6",
        brightMagenta: "#c792ea",
        brightCyan: "#39bae6",
        brightWhite: "#ffffff",
      },
      fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
      fontSize: zoom,
      cursorBlink: true,
      scrollback: 5000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    term.open(containerRef.current);
    termRef.current = term;
    fitRef.current = fitAddon;

    // Initial fit + focus
    requestAnimationFrame(() => {
      try {
        fitAddon.fit();
        term.focus();
      } catch {}
    });

    // Subscribe to output
    socket.emit("terminal:subscribe", terminalId);

    const onData = ({ id, data }: { id: string; data: string }) => {
      if (id === terminalId) term.write(data);
    };
    socket.on("terminal:data", onData);

    // Forward user input
    const inputDisposable = term.onData((data) => {
      socket.emit("terminal:input", { id: terminalId, data });
    });

    // Resize handling
    let resizeTimer: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        try {
          fitAddon.fit();
          socket.emit("terminal:resize", {
            id: terminalId,
            cols: term.cols,
            rows: term.rows,
          });
        } catch {}
      }, 100);
    });
    observer.observe(containerRef.current);

    return () => {
      clearTimeout(resizeTimer);
      observer.disconnect();
      inputDisposable.dispose();
      socket.off("terminal:data", onData);
      socket.emit("terminal:unsubscribe", terminalId);
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [terminalId, active, containerRef]);

  // React to zoom changes
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.fontSize = zoom;
      try { fitRef.current?.fit(); } catch {}
    }
  }, [zoom]);

  return { termRef, focus };
}
