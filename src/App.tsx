import { Component, type ReactNode } from "react";
import { useSocket } from "./hooks/useSocket";
import { useShortcuts } from "./hooks/useShortcuts";
import { useBossSocket } from "./hooks/useBossSocket";
import TopBar from "./components/TopBar";
import BookmarkSidebar from "./components/BookmarkSidebar";
import TerminalGrid from "./components/TerminalGrid";
import BossChat from "./components/BossChat";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, color: "#ff6b6b", fontFamily: "monospace", background: "#0a0e14", minHeight: "100vh" }}>
          <h1 style={{ color: "#39bae6", marginBottom: 16 }}>SmartTerm crashed</h1>
          <pre style={{ whiteSpace: "pre-wrap", color: "#c5cdd9" }}>{this.state.error.message}</pre>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "#6b7a8d", marginTop: 8 }}>{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppInner() {
  useSocket();
  useShortcuts();
  useBossSocket();

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        <BookmarkSidebar />
        <TerminalGrid />
        <BossChat />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
