import { useState, useEffect } from "react";

interface WizardProps {
  onComplete: () => void;
}

type Step = "welcome" | "apikey" | "workspace" | "telegram" | "done";

export default function SetupWizard({ onComplete }: WizardProps) {
  const [step, setStep] = useState<Step>("welcome");
  const [apiKey, setApiKey] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [telegramToken, setTelegramToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Try to detect a reasonable default workspace
  useEffect(() => {
    const home = navigator.userAgent.includes("Windows")
      ? "C:\\Users\\" + (navigator.userAgent.match(/Windows NT/) ? "" : "")
      : "~";
    setWorkspace(home);
  }, []);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anthropicApiKey: apiKey,
          workspaceRoot: workspace,
          telegramBotToken: telegramToken,
          telegramChatId: telegramChatId,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Save failed");
      setStep("done");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: "rgb(var(--t-bg))" }}>
      <div className="w-[520px] max-w-[90vw]">

        {/* Welcome */}
        {step === "welcome" && (
          <div className="text-center space-y-6">
            <img src="/icons/icon-192.png" alt="SmartTerm" className="w-20 h-20 mx-auto" />
            <h1 className="text-2xl font-bold text-terminal-text">Welcome to SmartTerm</h1>
            <p className="text-sm text-terminal-dim leading-relaxed">
              AI-powered terminal multiplexer for orchestrating Claude Code sessions.
              Let's get you set up in 30 seconds.
            </p>
            <button
              onClick={() => setStep("apikey")}
              className="btn-primary px-8 py-2.5 text-sm"
            >
              Get Started
            </button>
          </div>
        )}

        {/* API Key */}
        {step === "apikey" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-terminal-text">Anthropic API Key</h2>
              <p className="text-xs text-terminal-dim mt-1">
                Required for the Boss AI supervisor. Get one at console.anthropic.com
              </p>
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="input-field font-mono"
              autoFocus
            />
            <div className="flex justify-between">
              <button onClick={() => setStep("welcome")} className="btn-ghost text-xs">Back</button>
              <button
                onClick={() => setStep("workspace")}
                disabled={!apiKey.startsWith("sk-ant-")}
                className="btn-primary text-xs"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Workspace */}
        {step === "workspace" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-terminal-text">Workspace Directory</h2>
              <p className="text-xs text-terminal-dim mt-1">
                The root folder where your projects live. Boss will scan this to find repos when you say "open my math folder" etc.
              </p>
            </div>
            <input
              value={workspace}
              onChange={(e) => setWorkspace(e.target.value)}
              placeholder="C:\Users\you\Projects"
              className="input-field font-mono"
              autoFocus
            />
            <div className="flex justify-between">
              <button onClick={() => setStep("apikey")} className="btn-ghost text-xs">Back</button>
              <button
                onClick={() => setStep("telegram")}
                disabled={!workspace.trim()}
                className="btn-primary text-xs"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Telegram (optional) */}
        {step === "telegram" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-terminal-text">Telegram Notifications</h2>
              <p className="text-xs text-terminal-dim mt-1">
                Optional. Control Boss from your phone and get alerts when terminals need attention.
                Create a bot via @BotFather on Telegram to get a token.
              </p>
            </div>
            <input
              value={telegramToken}
              onChange={(e) => setTelegramToken(e.target.value)}
              placeholder="Bot token (optional)"
              className="input-field font-mono"
              autoFocus
            />
            <input
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              placeholder="Your chat ID (optional)"
              className="input-field font-mono"
            />
            <p className="text-[10px] text-terminal-dim">
              To get your chat ID: message your bot, then visit
              https://api.telegram.org/bot[TOKEN]/getUpdates
            </p>
            {error && <p className="text-xs text-terminal-red">{error}</p>}
            <div className="flex justify-between">
              <button onClick={() => setStep("workspace")} className="btn-ghost text-xs">Back</button>
              <button
                onClick={save}
                disabled={saving}
                className="btn-primary text-xs"
              >
                {saving ? "Saving..." : "Finish Setup"}
              </button>
            </div>
          </div>
        )}

        {/* Done */}
        {step === "done" && (
          <div className="text-center space-y-6">
            <div className="text-4xl">&#10003;</div>
            <h2 className="text-lg font-semibold text-terminal-text">You're all set!</h2>
            <p className="text-xs text-terminal-dim">
              Config saved. You can change these anytime in Settings (gear icon).
            </p>
            <button
              onClick={onComplete}
              className="btn-primary px-8 py-2.5 text-sm"
            >
              Launch SmartTerm
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
