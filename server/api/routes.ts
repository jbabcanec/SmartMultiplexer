import { Router, Request, Response } from "express";
import { ptyManager } from "../pty/manager.js";
import * as db from "../db/index.js";

const router = Router();

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
