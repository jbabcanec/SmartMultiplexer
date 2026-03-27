import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import apiRoutes from "./api/routes.js";
import { setupSocket } from "./api/socket.js";
import { getDb } from "./db/index.js";
import { createLogger } from "./lib/logger.js";
import { ptyManager } from "./pty/manager.js";

const log = createLogger("server");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || "4800");

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: "*" },
  pingTimeout: 60000,
  maxHttpBufferSize: 1e6,
});

app.use(cors());
app.use(express.json());

// API routes
app.use("/api", apiRoutes);

// Serve built frontend in production
const distPath = path.resolve(__dirname, "../dist");
app.use(express.static(distPath));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// Initialize DB (groups only)
getDb();
log.info("Database initialized");

// Socket.IO
setupSocket(io);
log.info("Socket.IO handlers registered");

log.info("ANTHROPIC_API_KEY", process.env.ANTHROPIC_API_KEY ? "set" : "NOT SET");

// Kill all PTY processes on shutdown so we don't leave orphans
function shutdown() {
  log.info("Shutting down — killing all terminals");
  ptyManager.killAll();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("exit", () => ptyManager.killAll());

httpServer.listen(PORT, () => {
  log.info(`SmartTerm v2.0 listening on http://localhost:${PORT}`);
});
