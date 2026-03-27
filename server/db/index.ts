import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SCHEMA, MIGRATIONS } from "./schema.js";

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
    db.exec(MIGRATIONS);
    db.exec(SCHEMA);
  }
  return db;
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
