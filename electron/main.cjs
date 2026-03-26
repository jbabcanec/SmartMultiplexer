const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

const isDev = !app.isPackaged;
const PORT = 4800;
let mainWindow = null;
let serverProcess = null;

function startServer() {
  if (isDev) return; // dev server runs separately
  const serverPath = path.join(__dirname, "../dist/server/index.js");
  serverProcess = spawn(process.execPath, [serverPath], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: "pipe",
  });
  serverProcess.stdout?.on("data", (d) => console.log("[server]", d.toString()));
  serverProcess.stderr?.on("data", (d) => console.error("[server]", d.toString()));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 500,
    title: "SmartTerm",
    backgroundColor: "#0a0e14",
    frame: false,
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#111820",
      symbolColor: "#c5cdd9",
      height: 32,
    },
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadURL(`http://localhost:${PORT}`);
  }

  // Keyboard shortcuts
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.control && !input.shift && !input.alt) {
      switch (input.key.toLowerCase()) {
        case "t":
          mainWindow.webContents.send("shortcut", "new-terminal");
          break;
        case "w":
          mainWindow.webContents.send("shortcut", "close-terminal");
          break;
        case "b":
          mainWindow.webContents.send("shortcut", "toggle-boss");
          break;
        case "tab":
          mainWindow.webContents.send("shortcut", "next-terminal");
          event.preventDefault();
          break;
        case "=":
        case "+":
          mainWindow.webContents.send("shortcut", "zoom-in");
          event.preventDefault();
          break;
        case "-":
          mainWindow.webContents.send("shortcut", "zoom-out");
          event.preventDefault();
          break;
        case "0":
          mainWindow.webContents.send("shortcut", "zoom-reset");
          event.preventDefault();
          break;
      }
    }
    if (input.control && input.shift && input.key === "Tab") {
      mainWindow.webContents.send("shortcut", "prev-terminal");
      event.preventDefault();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.openDevTools({ mode: "bottom" });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startServer();
  const delay = isDev ? 0 : 1500;
  setTimeout(createWindow, delay);
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("activate", () => {
  if (!mainWindow) createWindow();
});

app.on("before-quit", () => {
  if (serverProcess) serverProcess.kill();
});
