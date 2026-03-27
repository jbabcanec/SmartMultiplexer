<p align="center">
  <img src="build/icon-128.png" alt="SmartTerm" width="96" />
</p>

<h1 align="center">SmartTerm</h1>

<p align="center">
  AI-powered terminal multiplexer for orchestrating Claude Code sessions from your desktop or phone.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-41-47848F?logo=electron" />
  <img src="https://img.shields.io/badge/Claude_API-Sonnet_4.5-D97757?logo=anthropic" />
  <img src="https://img.shields.io/badge/License-MIT-green" />
</p>

---

## What It Does

SmartTerm is a desktop app that lets you run multiple Claude Code terminals side by side, with an AI supervisor ("Boss") that can see, control, and coordinate all of them. Walk away from your keyboard and keep managing everything from Telegram.

## Features

- **Multi-terminal grid** -- Spawn, rename, drag-reorder, maximize, and minimize terminals in an auto-sizing grid
- **Boss Agent** -- AI supervisor using Claude API with structured tool use. Can list terminals, read output, send commands, spawn Claude Code workers, kill terminals, and rename them
- **Telegram bridge** -- Text your bot from your phone, Boss responds there. Come back to your desk, conversation continues in the app. Seamless channel switching
- **Desktop notifications** -- Boss can push native notifications when tasks finish or errors occur
- **Workspace scanning** -- Boss knows your project folders (two levels deep) and resolves fuzzy names like "my math folder" to actual paths
- **Claude Code integration** -- Spawns Claude Code sessions with optional `--dangerously-skip-permissions`, auto-accepts trust prompts
- **Dark / Light theme** -- Toggle in settings, powered by CSS variables
- **Settings UI** -- Configure workspace root, default shell, theme, and Telegram from the gear icon
- **Session persistence** -- Save and restore terminal layouts
- **Keyboard shortcuts** -- `Ctrl+T` new, `Ctrl+W` close, `Ctrl+B` Boss, `Ctrl+Tab` cycle, `Ctrl+/- /0` zoom
- **Scoped logging** -- Color-coded server logs with timestamps (`[pty]`, `[boss]`, `[telegram]`, `[socket]`)
- **Clean shutdown** -- Server kills all PTY child processes on exit, no orphaned shells

## Tech Stack

| Layer | Tech |
|-------|------|
| Desktop | Electron 41, NSIS installer |
| Frontend | React 18, Tailwind CSS 3, Zustand 5, xterm.js 6 |
| Backend | Express 4, Socket.IO 4, node-pty |
| AI | Anthropic SDK -- Claude Sonnet 4.5 with streaming tool use |
| Notifications | Telegram Bot API, Web Notifications |
| Database | better-sqlite3 (groups only -- terminals are in-memory) |
| Build | Vite 5, TypeScript 5, electron-builder |

## Getting Started

### Prerequisites

- Node.js 18+
- Windows (node-pty + ConPTY; Linux/macOS may work but untested)
- [Anthropic API key](https://console.anthropic.com/) for Boss Agent

### Install

```bash
git clone https://github.com/jbabcanec/SmartMultiplexer.git
cd SmartMultiplexer
npm install
```

Create `.env` in the project root:

```env
ANTHROPIC_API_KEY=sk-ant-...
TELEGRAM_BOT_TOKEN=...       # optional -- create via @BotFather
TELEGRAM_CHAT_ID=...         # optional -- your Telegram user ID
```

### Development

```bash
npm run dev:electron     # server + Vite + Electron window
```

### Production Build

```bash
npm run build            # compile frontend + server
npm run dist             # package Windows NSIS installer + portable exe
```

Installers output to `release/`.

## Project Structure

```
SmartTerm/
  electron/            Electron main process + preload
  server/
    agents/            Boss Agent (Claude API) + Telegram bridge
    api/               REST routes + Socket.IO handlers
    db/                SQLite (groups only)
    lib/               Logger
    pty/               PTY manager (spawn, I/O, resize, lifecycle)
  src/
    components/        TopBar, TerminalGrid, TerminalPanel, BossChat,
                       BookmarkSidebar, SettingsModal
    hooks/             useSocket, useBossSocket, useShortcuts, useTerminal
    stores/            Zustand store (terminals, boss chat, settings)
    styles/            Theme variables (dark/light)
  build/               App icons (SVG, ICO, PNG)
```

## Boss Agent Tools

The Boss AI has these tools available via structured tool use:

| Tool | Description |
|------|-------------|
| `list_projects` | Scan workspace root for project directories |
| `list_terminals` | List all open terminals with status |
| `get_terminal_output` | Read last N lines from a terminal (ANSI-stripped) |
| `send_command` | Type a command into a terminal |
| `spawn_worker` | Open a new terminal with Claude Code (optional task, optional --dangerously-skip-permissions) |
| `kill_terminal` | Kill and remove a terminal |
| `kill_all_terminals` | Stop everything |
| `rename_terminal` | Rename or alias a terminal |
| `notify_user` | Send desktop + Telegram notification |

## How It Works

1. **Express server** spawns PTY processes via `node-pty`, manages them in a single in-memory Map
2. **PtyManager** emits lifecycle events (`created`, `exit`, `removed`, `renamed`) -- Socket.IO forwards them to all clients
3. **React frontend** renders terminals with `xterm.js` in a responsive CSS grid, state managed by Zustand
4. **Boss Agent** uses `@anthropic-ai/sdk` with streaming tool use -- processes messages through an agentic loop (message -> tool calls -> results -> continue until done)
5. **Telegram bridge** polls for messages, routes them through the same Boss Agent, mirrors conversation back to the app UI
6. **Electron** wraps everything into a native window with keyboard shortcuts and titlebar overlay

## License

MIT -- Joseph Babcanec
