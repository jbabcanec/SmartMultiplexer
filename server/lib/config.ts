import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { createLogger } from "./logger.js";

const log = createLogger("config");

export interface AppConfig {
  anthropicApiKey: string;
  workspaceRoot: string;
  telegramBotToken: string;
  telegramChatId: string;
  defaultShell: string;
  theme: "dark" | "light";
}

const DEFAULTS: AppConfig = {
  anthropicApiKey: "",
  workspaceRoot: "",
  telegramBotToken: "",
  telegramChatId: "",
  defaultShell: process.platform === "win32" ? "powershell.exe" : "/bin/bash",
  theme: "dark",
};

function getConfigDir(): string {
  const appData = process.env.APPDATA
    || process.env.XDG_CONFIG_HOME
    || join(process.env.HOME || "", ".config");
  return join(appData, "SmartTerm");
}

function getConfigPath(): string {
  return join(getConfigDir(), "config.json");
}

let cached: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cached) return cached;

  const configPath = getConfigPath();

  // Start with defaults
  let config = { ...DEFAULTS };

  // Layer 1: config.json from AppData
  if (existsSync(configPath)) {
    try {
      const stored = JSON.parse(readFileSync(configPath, "utf-8"));
      config = { ...config, ...stored };
      log.info(`Config loaded from ${configPath}`);
    } catch (err: any) {
      log.warn("Failed to parse config.json", err.message);
    }
  }

  // Layer 2: env vars override (for dev / .env)
  if (process.env.ANTHROPIC_API_KEY) config.anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (process.env.WORKSPACE_ROOT) config.workspaceRoot = process.env.WORKSPACE_ROOT;
  if (process.env.TELEGRAM_BOT_TOKEN) config.telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  if (process.env.TELEGRAM_CHAT_ID) config.telegramChatId = process.env.TELEGRAM_CHAT_ID;

  cached = config;
  return config;
}

export function saveConfig(patch: Partial<AppConfig>): AppConfig {
  const current = loadConfig();
  const updated = { ...current, ...patch };

  const dir = getConfigDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  writeFileSync(getConfigPath(), JSON.stringify(updated, null, 2), "utf-8");
  log.info(`Config saved to ${getConfigPath()}`);

  cached = updated;
  return updated;
}

export function isConfigured(): boolean {
  const config = loadConfig();
  return !!config.anthropicApiKey && !!config.workspaceRoot;
}

/** Mask a secret for display (show first 8 and last 4 chars) */
export function maskSecret(s: string): string {
  if (!s || s.length < 16) return s ? "****" : "";
  return s.slice(0, 8) + "..." + s.slice(-4);
}
