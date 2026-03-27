type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_COLOR: Record<LogLevel, string> = {
  debug: "\x1b[90m",   // gray
  info: "\x1b[36m",    // cyan
  warn: "\x1b[33m",    // yellow
  error: "\x1b[31m",   // red
};

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

const minLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel];
}

function timestamp(): string {
  return new Date().toISOString().slice(11, 23); // HH:mm:ss.SSS
}

function formatMessage(level: LogLevel, scope: string, msg: string, data?: unknown): string {
  const color = LEVEL_COLOR[level];
  const tag = level.toUpperCase().padEnd(5);
  const prefix = `${BOLD}${color}${tag}${RESET} ${"\x1b[90m"}${timestamp()}${RESET} [${scope}]`;
  let line = `${prefix} ${msg}`;
  if (data !== undefined) {
    const str = typeof data === "string" ? data : JSON.stringify(data, null, 2);
    // Keep data on same line if short, otherwise newline
    if (str.length < 80 && !str.includes("\n")) {
      line += ` ${"\x1b[90m"}${str}${RESET}`;
    } else {
      line += `\n${"\x1b[90m"}${str}${RESET}`;
    }
  }
  return line;
}

export function createLogger(scope: string) {
  return {
    debug(msg: string, data?: unknown) {
      if (shouldLog("debug")) console.debug(formatMessage("debug", scope, msg, data));
    },
    info(msg: string, data?: unknown) {
      if (shouldLog("info")) console.info(formatMessage("info", scope, msg, data));
    },
    warn(msg: string, data?: unknown) {
      if (shouldLog("warn")) console.warn(formatMessage("warn", scope, msg, data));
    },
    error(msg: string, data?: unknown) {
      if (shouldLog("error")) console.error(formatMessage("error", scope, msg, data));
    },
  };
}
