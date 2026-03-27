import { Router, Request, Response } from "express";
import { ptyManager } from "../pty/manager.js";
import * as db from "../db/index.js";
import { loadConfig, saveConfig, isConfigured, maskSecret } from "../lib/config.js";

const router = Router();

// --- Config ---

router.get("/config", (_req: Request, res: Response) => {
  const config = loadConfig();
  res.json({
    configured: isConfigured(),
    anthropicApiKey: maskSecret(config.anthropicApiKey),
    workspaceRoot: config.workspaceRoot,
    telegramBotToken: maskSecret(config.telegramBotToken),
    telegramChatId: config.telegramChatId,
    defaultShell: config.defaultShell,
    theme: config.theme,
  });
});

router.post("/config", (req: Request, res: Response) => {
  try {
    const updated = saveConfig(req.body);
    res.json({
      ok: true,
      configured: !!updated.anthropicApiKey && !!updated.workspaceRoot,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Terminals ---

router.get("/terminals", (_req: Request, res: Response) => {
  res.json(ptyManager.list());
});

router.post("/terminals", (req: Request, res: Response) => {
  try {
    const info = ptyManager.spawn(req.body || {});
    res.json(info);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/terminals/:id", (req: Request, res: Response) => {
  ptyManager.remove(req.params.id);
  res.json({ ok: true });
});

router.put("/terminals/:id/name", (req: Request, res: Response) => {
  ptyManager.rename(req.params.id, req.body.name);
  res.json({ ok: true });
});

router.put("/terminals/:id/group", (req: Request, res: Response) => {
  ptyManager.setGroup(req.params.id, req.body.groupName || null);
  res.json({ ok: true });
});

// Get recent output from a terminal (last N lines, default 30)
router.get("/terminals/:id/output", (req: Request, res: Response) => {
  const lines = parseInt(req.query.lines as string) || 30;
  if (!ptyManager.getInfo(req.params.id)) {
    res.status(404).json({ error: "Terminal not found" });
    return;
  }
  const buf = ptyManager.getScrollback(req.params.id);
  const clean = buf.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").replace(/\r/g, "");
  const allLines = clean.split("\n").filter((l) => l.trim());
  res.json({ lines: allLines.slice(-lines) });
});

// Send input to a terminal
router.post("/terminals/:id/input", (req: Request, res: Response) => {
  const { input } = req.body;
  if (!input) {
    res.status(400).json({ error: "input is required" });
    return;
  }
  if (!ptyManager.isRunning(req.params.id)) {
    res.status(404).json({ error: "Terminal not found or not running" });
    return;
  }
  ptyManager.write(req.params.id, input);
  res.json({ ok: true });
});

// --- Groups ---

router.get("/groups", (_req: Request, res: Response) => {
  res.json(db.listGroups());
});

router.post("/groups", (req: Request, res: Response) => {
  const { name, color, description } = req.body;
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  try {
    db.insertGroup({ name, color: color || "#39bae6", description: description || "" });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/groups/:name", (req: Request, res: Response) => {
  db.deleteGroup(req.params.name);
  res.json({ ok: true });
});

export default router;
