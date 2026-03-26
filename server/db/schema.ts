export const SCHEMA = `
CREATE TABLE IF NOT EXISTS groups (
  name TEXT PRIMARY KEY,
  color TEXT NOT NULL DEFAULT '#39bae6',
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS terminals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  group_name TEXT,
  shell TEXT NOT NULL,
  cwd TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  exit_code INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (group_name) REFERENCES groups(name) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_terminals_group ON terminals(group_name);
CREATE INDEX IF NOT EXISTS idx_terminals_status ON terminals(status);
`;
