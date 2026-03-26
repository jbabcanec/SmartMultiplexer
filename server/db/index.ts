import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SCHEMA } from "./schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "../../data/smartterm.db");

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.exec(SCHEMA);
  }
  return db;
}

// --- Terminal queries ---

export interface TerminalRow {
  id: string;
  name: string;
  group_name: string | null;
  shell: string;
  cwd: string;
  status: string;
  exit_code: number | null;
  created_at: number;
}

export function insertTerminal(t: TerminalRow) {
  getDb()
    .prepare(
      `INSERT INTO terminals (id, name, group_name, shell, cwd, status, exit_code, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(t.id, t.name, t.group_name, t.shell, t.cwd, t.status, t.exit_code, t.created_at);
}

export function updateTerminal(id: string, fields: Partial<TerminalRow>) {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, val] of Object.entries(fields)) {
    if (key === "id") continue;
    sets.push(`${key} = ?`);
    values.push(val);
  }
  if (!sets.length) return;
  values.push(id);
  getDb().prepare(`UPDATE terminals SET ${sets.join(", ")} WHERE id = ?`).run(...values);
}

export function getTerminal(id: string): TerminalRow | undefined {
  return getDb().prepare("SELECT * FROM terminals WHERE id = ?").get(id) as TerminalRow | undefined;
}

export function listTerminals(): TerminalRow[] {
  return getDb().prepare("SELECT * FROM terminals ORDER BY created_at DESC").all() as TerminalRow[];
}

export function deleteTerminal(id: string) {
  getDb().prepare("DELETE FROM terminals WHERE id = ?").run(id);
}

// --- Group queries ---

export interface GroupRow {
  name: string;
  color: string;
  description: string;
}

export function insertGroup(g: GroupRow) {
  getDb()
    .prepare("INSERT INTO groups (name, color, description) VALUES (?, ?, ?)")
    .run(g.name, g.color, g.description);
}

export function listGroups(): GroupRow[] {
  return getDb().prepare("SELECT * FROM groups ORDER BY name").all() as GroupRow[];
}

export function deleteGroup(name: string) {
  getDb().prepare("DELETE FROM groups WHERE name = ?").run(name);
}

