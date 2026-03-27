import Anthropic from "@anthropic-ai/sdk";
import type {
  MessageParam,
  Tool,
  ToolUseBlock,
  ToolResultBlockParam,
} from "@anthropic-ai/sdk/resources/messages";
import { readdirSync, statSync } from "fs";
import { join } from "path";
import { ptyManager } from "../pty/manager.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("boss");

const MODEL = "claude-sonnet-4-5-20250929";
const MAX_TOKENS = 4096;
const MAX_TOOL_ROUNDS = 25;
const MAX_TERMINALS = 8;
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || "C:\\Users\\josep\\Dropbox\\Babcanec Works";

const SYSTEM_PROMPT = `You are Boss, a terse terminal supervisor. No markdown formatting — plain text only. No **bold**, no *italic*, no bullet lists. Write short, direct sentences.

You control terminals in SmartTerm. You can list them, read output, send commands, spawn workers, kill them, and notify the user.

Workspace root: ${WORKSPACE_ROOT}
All projects live as subdirectories of this root.

Rules:
- Plain text only. No markdown. No emojis.
- Be extremely brief. One or two sentences max unless asked for detail.
- When spawning a terminal: if user says a project name like "smartterm" or "sumo", use list_projects to find the exact path under the workspace root. Only ask if truly ambiguous.
- When spawning Claude Code workers: pass --dangerously-skip-permissions if the user asks for no permissions, bypass, dangerous mode, or skip permissions.
- Before killing terminals, confirm with the user first.
- Max ${MAX_TERMINALS} terminals. Never spawn more than 2 in one turn without asking.
- When a terminal is killed, it is fully removed from the grid.
- Use notify_user for long tasks finishing or errors.
- "talk to Terminal X" or "tell Terminal X" = use send_command.`;

const TOOLS: Tool[] = [
  {
    name: "list_projects",
    description:
      "List available project directories under the workspace root. Use this to resolve fuzzy project names to real paths.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "list_terminals",
    description:
      "List all open terminals with their ID, name, status, and working directory.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "get_terminal_output",
    description:
      "Get the last N lines of output from a specific terminal (ANSI codes stripped).",
    input_schema: {
      type: "object" as const,
      properties: {
        terminal_id: { type: "string", description: "The terminal UUID" },
        lines: {
          type: "number",
          description: "Number of lines to retrieve (default 50, max 200)",
        },
      },
      required: ["terminal_id"],
    },
  },
  {
    name: "send_command",
    description:
      "Send a command to a running terminal. The command is written to stdin followed by Enter.",
    input_schema: {
      type: "object" as const,
      properties: {
        terminal_id: { type: "string", description: "The terminal UUID" },
        command: { type: "string", description: "The command to execute" },
      },
      required: ["terminal_id", "command"],
    },
  },
  {
    name: "spawn_worker",
    description:
      "Create a new terminal and optionally start Claude Code. If task is omitted, just opens Claude Code with no initial prompt so the user can resume or start fresh.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Terminal name",
        },
        task: {
          type: "string",
          description: "Optional task for Claude Code. If omitted, Claude Code starts with no prompt.",
        },
        cwd: {
          type: "string",
          description: "Working directory — MUST be specified. Ask the user if not provided.",
        },
        dangerously_skip_permissions: {
          type: "boolean",
          description: "Pass --dangerously-skip-permissions to Claude Code. Use when user asks for no permissions, bypass, or dangerous mode.",
        },
      },
      required: ["cwd"],
    },
  },
  {
    name: "kill_terminal",
    description: "Kill and remove a terminal from the grid entirely.",
    input_schema: {
      type: "object" as const,
      properties: {
        terminal_id: { type: "string", description: "The terminal UUID" },
      },
      required: ["terminal_id"],
    },
  },
  {
    name: "rename_terminal",
    description: "Rename a terminal or give it an alias.",
    input_schema: {
      type: "object" as const,
      properties: {
        terminal_id: { type: "string", description: "The terminal UUID" },
        name: { type: "string", description: "New name or alias" },
      },
      required: ["terminal_id", "name"],
    },
  },
  {
    name: "kill_all_terminals",
    description: "Kill and remove ALL terminals. Only use when user explicitly asks to stop everything.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "notify_user",
    description:
      "Send a desktop notification to the user. Use this when a long-running task finishes, something errors out, or you need the user's attention.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Notification title" },
        body: { type: "string", description: "Notification body text" },
      },
      required: ["title", "body"],
    },
  },
];

// --- Chunk types emitted to the client ---

export interface BossChunk {
  type:
    | "text_delta"
    | "tool_use_start"
    | "tool_input_delta"
    | "tool_result"
    | "notification"
    | "done"
    | "error";
  text?: string;
  toolUseId?: string;
  toolName?: string;
  partialJson?: string;
  result?: string;
  isError?: boolean;
  error?: string;
  title?: string;
  body?: string;
}

export type ChunkCallback = (chunk: BossChunk) => void;

// --- Tool execution ---

function stripAnsi(s: string): string {
  return s
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "")  // OSC sequences (title sets, etc.)
    .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "")               // CSI sequences
    .replace(/\x1b[>=<][0-9]*[a-zA-Z]/g, "")              // Private mode sets
    .replace(/\x1b\([A-Z0-9]/g, "")                        // Character set selection
    .replace(/\r/g, "");
}

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  onChunk?: ChunkCallback
): Promise<{ result: string; isError: boolean }> {
  try {
    switch (name) {
      case "list_projects": {
        try {
          const results: string[] = [];
          const topDirs = readdirSync(WORKSPACE_ROOT).filter((e) => {
            try { return statSync(join(WORKSPACE_ROOT, e)).isDirectory(); } catch { return false; }
          });
          for (const top of topDirs) {
            const topPath = join(WORKSPACE_ROOT, top);
            results.push(`[${top}]`);
            try {
              const subs = readdirSync(topPath).filter((e) => {
                try { return statSync(join(topPath, e)).isDirectory(); } catch { return false; }
              });
              for (const sub of subs) {
                results.push(`  ${sub} -> ${join(topPath, sub)}`);
              }
            } catch { /* skip unreadable */ }
          }
          return { result: results.join("\n") || "No projects found.", isError: false };
        } catch (err: any) {
          return { result: `Cannot read workspace: ${err.message}`, isError: true };
        }
      }

      case "list_terminals": {
        const list = ptyManager.list().map((t) => ({
          id: t.id,
          name: t.name,
          status: t.status,
          cwd: t.cwd,
          groupName: t.groupName,
        }));
        return { result: JSON.stringify(list, null, 2), isError: false };
      }

      case "get_terminal_output": {
        const id = input.terminal_id as string;
        const lines = Math.min((input.lines as number) || 50, 200);
        const info = ptyManager.getInfo(id);
        if (!info) return { result: `Terminal ${id} not found.`, isError: true };
        const buf = stripAnsi(ptyManager.getScrollback(id));
        const allLines = buf.split("\n").filter((l) => l.trim());
        const output = allLines.slice(-lines).join("\n");
        return {
          result: output || "(no output yet)",
          isError: false,
        };
      }

      case "send_command": {
        const id = input.terminal_id as string;
        const command = input.command as string;
        if (!ptyManager.isRunning(id)) {
          return { result: `Terminal ${id} is not running.`, isError: true };
        }
        const info = ptyManager.getInfo(id);
        ptyManager.write(id, command + "\r");
        return {
          result: `Command sent to "${info?.name || id}".`,
          isError: false,
        };
      }

      case "spawn_worker": {
        const currentCount = ptyManager.list().length;
        if (currentCount >= MAX_TERMINALS) {
          return {
            result: `Cannot spawn: at max capacity (${MAX_TERMINALS}). Kill some first.`,
            isError: true,
          };
        }
        const task = input.task as string | undefined;
        const cwd = input.cwd as string;
        const skipPerms = input.dangerously_skip_permissions as boolean;
        const workerName = (input.name as string) || (task ? `Worker: ${task.slice(0, 30)}` : cwd.split(/[\\/]/).pop() || "Terminal");
        const info = ptyManager.spawn({
          name: workerName,
          cwd,
          shell: process.platform === "win32" ? "powershell.exe" : undefined,
        });

        try {
          await ptyManager.waitForOutput(info.id, /PS [A-Z]:|[$#]\s*$/i, 15000);
        } catch {
          // Shell might already be ready
        }

        const permsFlag = skipPerms ? " --dangerously-skip-permissions" : "";
        if (task) {
          const escapedTask = task.replace(/"/g, '`"');
          ptyManager.write(info.id, `claude${permsFlag} "${escapedTask}"\r`);
        } else {
          ptyManager.write(info.id, `claude${permsFlag}\r`);
        }

        // Auto-accept the "trust this folder" prompt
        try {
          await ptyManager.waitForOutput(info.id, /trust this folder|Yes, I trust/i, 20000);
          ptyManager.write(info.id, "\r"); // press Enter on "Yes, I trust this folder"
        } catch {
          // No trust prompt (already trusted or skipped permissions)
        }

        return {
          result: JSON.stringify({ terminal_id: info.id, name: info.name }),
          isError: false,
        };
      }

      case "kill_terminal": {
        const id = input.terminal_id as string;
        const info = ptyManager.getInfo(id);
        if (!info) return { result: `Terminal ${id} not found.`, isError: true };
        ptyManager.remove(id);
        return { result: `Killed and removed "${info.name}".`, isError: false };
      }

      case "rename_terminal": {
        const id = input.terminal_id as string;
        const newName = input.name as string;
        const info = ptyManager.getInfo(id);
        if (!info) return { result: `Terminal ${id} not found.`, isError: true };
        ptyManager.rename(id, newName);
        return { result: `Renamed to "${newName}".`, isError: false };
      }

      case "kill_all_terminals": {
        const all = ptyManager.list();
        if (all.length === 0) return { result: "No terminals to kill.", isError: false };
        const names = all.map((t) => t.name);
        for (const t of all) ptyManager.remove(t.id);
        return { result: `Killed ${names.length}: ${names.join(", ")}`, isError: false };
      }

      case "notify_user": {
        const title = input.title as string;
        const body = input.body as string;
        // Desktop notification via client
        onChunk?.({ type: "notification", title, body });
        // Telegram notification
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;
        if (botToken && chatId) {
          try {
            const text = `*${title}*\n${body}`;
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
            });
            log.info("Telegram notification sent");
          } catch (err: any) {
            log.warn("Telegram notification failed", err.message);
          }
        }
        return { result: "Notification sent.", isError: false };
      }

      default:
        return { result: `Unknown tool: ${name}`, isError: true };
    }
  } catch (err: any) {
    return { result: `Tool error: ${err.message}`, isError: true };
  }
}

// --- BossAgent ---

export class BossAgent {
  private client: Anthropic;
  private history: MessageParam[] = [];
  private eventLog: string[] = [];
  private abortController: AbortController | null = null;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
    this.subscribeToEvents();
    log.info("BossAgent initialized");
  }

  private subscribeToEvents() {
    ptyManager.on("created", (info) => {
      this.pushEvent(`Terminal "${info.name}" created (${info.id.slice(0, 8)})`);
    });
    ptyManager.on("exit", (id: string, exitCode: number) => {
      const info = ptyManager.getInfo(id);
      this.pushEvent(
        `Terminal "${info?.name || id}" exited (code ${exitCode})`
      );
    });
    ptyManager.on("removed", (id: string) => {
      this.pushEvent(`Terminal ${id.slice(0, 8)} removed`);
    });
  }

  private pushEvent(msg: string) {
    this.eventLog.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
    if (this.eventLog.length > 50) this.eventLog.shift();
  }

  private getTerminalContext(): string {
    const terminals = ptyManager.list();
    if (terminals.length === 0) return "No terminals are open.";
    return terminals
      .map(
        (t) =>
          `- ${t.name} (${t.id.slice(0, 8)}) [${t.status}] cwd: ${t.cwd}`
      )
      .join("\n");
  }

  async processMessage(
    userText: string,
    onChunk: ChunkCallback
  ): Promise<void> {
    // Build user message with injected context
    let content = userText;
    const ctx = this.getTerminalContext();
    content += `\n\n<terminal_state>\n${ctx}\n</terminal_state>`;

    if (this.eventLog.length > 0) {
      content += `\n\n<recent_events>\n${this.eventLog.join("\n")}\n</recent_events>`;
      this.eventLog = [];
    }

    this.history.push({ role: "user", content });
    const historyLenBefore = this.history.length;
    log.info(`Processing message (${historyLenBefore} msgs in history)`);

    this.abortController = new AbortController();

    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        log.debug(`API call round ${round + 1}`);
        const stream = this.client.messages.stream(
          {
            model: MODEL,
            max_tokens: MAX_TOKENS,
            system: SYSTEM_PROMPT,
            tools: TOOLS,
            messages: this.history,
          },
          { signal: this.abortController.signal }
        );

        // Track current tool_use block for correlating input deltas
        let currentToolUseId: string | null = null;

        stream.on("text", (delta) => {
          onChunk({ type: "text_delta", text: delta });
        });

        stream.on("streamEvent", (event) => {
          if (
            event.type === "content_block_start" &&
            event.content_block.type === "tool_use"
          ) {
            currentToolUseId = event.content_block.id;
            onChunk({
              type: "tool_use_start",
              toolUseId: event.content_block.id,
              toolName: event.content_block.name,
            });
          }
        });

        stream.on("inputJson", (delta) => {
          if (currentToolUseId) {
            onChunk({
              type: "tool_input_delta",
              toolUseId: currentToolUseId,
              partialJson: delta,
            });
          }
        });

        const message = await stream.finalMessage();

        // Store assistant message in history
        this.history.push({ role: "assistant", content: message.content });

        if (message.stop_reason === "end_turn") {
          log.info("Turn complete");
          onChunk({ type: "done" });
          break;
        }

        if (message.stop_reason === "tool_use") {
          const toolUseBlocks = message.content.filter(
            (b): b is ToolUseBlock => b.type === "tool_use"
          );

          const toolResults: ToolResultBlockParam[] = [];
          for (const block of toolUseBlocks) {
            log.info(`Tool call: ${block.name}`, block.input);
            const { result, isError } = await executeTool(
              block.name,
              block.input as Record<string, unknown>,
              onChunk
            );
            if (isError) log.warn(`Tool error: ${block.name}`, result);
            onChunk({
              type: "tool_result",
              toolUseId: block.id,
              result,
              isError,
            });
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: result,
              is_error: isError,
            });
          }

          this.history.push({ role: "user", content: toolResults });
          currentToolUseId = null;
          continue;
        }

        // Unexpected stop reason
        onChunk({ type: "done" });
        break;
      }
    } catch (err: any) {
      if (err.name === "AbortError" || err.message?.includes("aborted")) {
        log.info("Aborted by user");
        onChunk({ type: "done" });
      } else {
        log.error("API error", err.message);
        // Remove the user message that failed so history stays clean
        if (this.history.length === historyLenBefore) {
          this.history.pop();
        }
        // Friendly error messages for common API issues
        let friendly = err.message;
        if (err.status === 400 && err.message?.includes("credit balance")) {
          friendly = "API credits are too low. Please add credits at console.anthropic.com and try again.";
        } else if (err.status === 401) {
          friendly = "Invalid API key. Check ANTHROPIC_API_KEY in your .env file.";
        } else if (err.status === 429) {
          friendly = "Rate limited. Wait a moment and try again.";
        } else if (err.status === 529) {
          friendly = "Anthropic API is overloaded. Try again in a few seconds.";
        }
        onChunk({ type: "error", error: friendly });
      }
    } finally {
      this.abortController = null;
    }

    // Trim history if it gets too long (rough token estimate: 4 chars per token)
    const historySize = JSON.stringify(this.history).length;
    if (historySize > 320_000 && this.history.length > 4) {
      // Remove oldest exchange (user + assistant pair)
      this.history.splice(0, 2);
    }
  }

  clearHistory() {
    this.history = [];
    this.eventLog = [];
  }

  abort() {
    this.abortController?.abort();
  }
}
