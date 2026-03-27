import { Component, type ReactNode, useState, useEffect } from "react";
import { useSocket } from "./hooks/useSocket";
import { useShortcuts } from "./hooks/useShortcuts";
import { useBossSocket } from "./hooks/useBossSocket";
import { useTerminalStore } from "./stores/terminalStore";
import TopBar from "./components/TopBar";
import BookmarkSidebar from "./components/BookmarkSidebar";
import TerminalGrid from "./components/TerminalGrid";
import BossChat from "./components/BossChat";
import SettingsModal from "./components/SettingsModal";
import SetupWizard from "./components/SetupWizard";

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

  const theme = useTerminalStore((s) => s.settings.theme);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => setNeedsSetup(!data.configured))
      .catch(() => setNeedsSetup(false)); // if fetch fails, skip wizard
  }, []);

  // Loading state while checking config
  if (needsSetup === null) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: "rgb(var(--t-bg))" }}>
        <span className="text-terminal-dim text-sm">Loading SmartTerm...</span>
      </div>
    );
  }

  // First-run wizard
  if (needsSetup) {
    return <SetupWizard onComplete={() => window.location.reload()} />;
  }

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${theme === "light" ? "theme-light" : ""}`}>
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        <BookmarkSidebar />
        <TerminalGrid />
        <BossChat />
      </div>
      <SettingsModal />
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
