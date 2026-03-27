export const SCHEMA = `
CREATE TABLE IF NOT EXISTS groups (
  name TEXT PRIMARY KEY,
  color TEXT NOT NULL DEFAULT '#39bae6',
  description TEXT NOT NULL DEFAULT ''
);
`;

/** One-time cleanup for existing installs that had the old terminals table */
export const MIGRATIONS = `
DROP TABLE IF EXISTS terminals;
`;
