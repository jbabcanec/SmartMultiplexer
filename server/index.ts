import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import apiRoutes from "./api/routes.js";
import { setupSocket } from "./api/socket.js";
import { getDb } from "./db/index.js";

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

// Socket.IO
setupSocket(io);

httpServer.listen(PORT, () => {
  console.log(`
  SmartTerm v2.0 | http://localhost:${PORT}
  `);
});
