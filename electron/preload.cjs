const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("smartterm", {
  onShortcut: (callback) => {
    ipcRenderer.on("shortcut", (_event, action) => callback(action));
  },
  platform: process.platform,
  isElectron: true,
});
