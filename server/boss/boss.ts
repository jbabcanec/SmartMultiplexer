import Anthropic from "@anthropic-ai/sdk";
import { ptyManager } from "../pty/manager.js";
import * as db from "../db/index.js";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are the Boss Agent for SmartTerm, a terminal multiplexer managing multiple Claude Code sessions.

You can see summaries of what each terminal is doing. When the user asks about their terminals, answer based on the summaries provided.

When the user wants you to type something into a terminal, respond with your explanation AND include a command block like this:
[TYPE terminal="Terminal Name" text="the command or text to type"]

You can reference terminals by their name or number. Be concise and helpful.`;

export async function handleBossMessage(
  userMessage: string,
  onChunk: (text: string) => void
): Promise<{ fullText: string; commands: BossCommand[] }> {
  // Save user message
  db.insertBossMessage({
    role: "user",
    content: userMessage,
    terminal_id: null,
    timestamp: Date.now(),
  });

  // Build context with terminal summaries
  const summaries = ptyManager.getSummaries();
  const terminals = ptyManager.list();

  const contextBlock = `Current terminals:\n${summaries}`;

  // Get recent conversation history
  const history = db.listBossMessages(20).reverse();
  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Add current message with context
  messages.push({
    role: "user",
    content: `${contextBlock}\n\n---\n\nUser: ${userMessage}`,
  });

  let fullText = "";

  try {
    const stream = client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        fullText += event.delta.text;
        onChunk(event.delta.text);
      }
    }
  } catch (err: any) {
    fullText = `Error: ${err.message}`;
    onChunk(fullText);
  }

  // Parse commands from response
  const commands = parseCommands(fullText, terminals);

  // Execute commands
  for (const cmd of commands) {
    if (cmd.action === "type" && cmd.terminalId) {
      ptyManager.write(cmd.terminalId, cmd.text + "\n");
    }
  }

  // Save assistant message
  db.insertBossMessage({
    role: "assistant",
    content: fullText,
    terminal_id: null,
    timestamp: Date.now(),
  });

  return { fullText, commands };
}

interface BossCommand {
  action: "type";
  terminalId: string;
  terminalName: string;
  text: string;
}

function parseCommands(
  text: string,
  terminals: { id: string; name: string }[]
): BossCommand[] {
  const commands: BossCommand[] = [];
  const regex = /\[TYPE\s+terminal="([^"]+)"\s+text="([^"]+)"\]/gi;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const termRef = match[1];
    const typedText = match[2];

    // Match by name or by number
    let terminal = terminals.find(
      (t) => t.name.toLowerCase() === termRef.toLowerCase()
    );
    if (!terminal) {
      const num = parseInt(termRef);
      if (!isNaN(num) && num >= 1 && num <= terminals.length) {
        terminal = terminals[num - 1];
      }
    }

    if (terminal) {
      commands.push({
        action: "type",
        terminalId: terminal.id,
        terminalName: terminal.name,
        text: typedText,
      });
    }
  }

  return commands;
}
