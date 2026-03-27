import { useTerminalStore } from "../stores/terminalStore";

export default function SettingsModal() {
  const open = useTerminalStore((s) => s.settingsOpen);
  const settings = useTerminalStore((s) => s.settings);
  const setSettingsOpen = useTerminalStore((s) => s.setSettingsOpen);
  const updateSettings = useTerminalStore((s) => s.updateSettings);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={() => setSettingsOpen(false)}
    >
      <div
        className="w-[480px] max-h-[80vh] overflow-y-auto rounded-lg border border-terminal-border bg-terminal-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-terminal-border">
          <span className="text-sm font-medium text-terminal-text">Settings</span>
          <button
            onClick={() => setSettingsOpen(false)}
            className="w-6 h-6 flex items-center justify-center text-terminal-dim hover:text-terminal-red rounded"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="3" y1="3" x2="9" y2="9" />
              <line x1="9" y1="3" x2="3" y2="9" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Theme */}
          <div>
            <label className="text-xs font-medium text-terminal-dim uppercase tracking-wider">Theme</label>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => updateSettings({ theme: "dark" })}
                className={`flex-1 py-2 rounded text-xs font-medium transition-colors ${
                  settings.theme === "dark"
                    ? "bg-terminal-accent/20 text-terminal-accent border border-terminal-accent/30"
                    : "bg-terminal-bg text-terminal-dim border border-terminal-border hover:text-terminal-text"
                }`}
              >
                Dark
              </button>
              <button
                onClick={() => updateSettings({ theme: "light" })}
                className={`flex-1 py-2 rounded text-xs font-medium transition-colors ${
                  settings.theme === "light"
                    ? "bg-terminal-accent/20 text-terminal-accent border border-terminal-accent/30"
                    : "bg-terminal-bg text-terminal-dim border border-terminal-border hover:text-terminal-text"
                }`}
              >
                Light
              </button>
            </div>
          </div>

          {/* Workspace Root */}
          <div>
            <label className="text-xs font-medium text-terminal-dim uppercase tracking-wider">Workspace Root</label>
            <p className="text-[10px] text-terminal-dim mt-0.5 mb-1.5">Default directory for new terminals and project lookup</p>
            <input
              value={settings.workspaceRoot}
              onChange={(e) => updateSettings({ workspaceRoot: e.target.value })}
              className="w-full bg-terminal-bg border border-terminal-border rounded px-2.5 py-1.5 text-xs text-terminal-text font-mono outline-none focus:border-terminal-accent/50"
            />
          </div>

          {/* Default Shell */}
          <div>
            <label className="text-xs font-medium text-terminal-dim uppercase tracking-wider">Default Shell</label>
            <input
              value={settings.defaultShell}
              onChange={(e) => updateSettings({ defaultShell: e.target.value })}
              className="w-full mt-1.5 bg-terminal-bg border border-terminal-border rounded px-2.5 py-1.5 text-xs text-terminal-text font-mono outline-none focus:border-terminal-accent/50"
            />
          </div>

          {/* Telegram */}
          <div>
            <label className="text-xs font-medium text-terminal-dim uppercase tracking-wider">Telegram Notifications</label>
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => updateSettings({ telegramEnabled: !settings.telegramEnabled })}
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  settings.telegramEnabled ? "bg-terminal-green" : "bg-terminal-border"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    settings.telegramEnabled ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
              <span className="text-xs text-terminal-dim">
                {settings.telegramEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>

          {/* Info */}
          <div className="pt-2 border-t border-terminal-border">
            <p className="text-[10px] text-terminal-dim">
              SmartTerm v2.0 — API keys and Telegram tokens are stored in .env (not synced)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
