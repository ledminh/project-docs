// project-docs/src/db.js
// UI-state only (config + todos). Content lives in files, never here.
const Database = require('better-sqlite3');
const path = require('path');
const { STATE_DIR, ensureDirs } = require('./paths');

ensureDirs();

const db = new Database(path.join(STATE_DIR, 'state.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS config (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS todos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    content    TEXT    NOT NULL,
    created_at TEXT    DEFAULT (datetime('now')),
    sort_order INTEGER DEFAULT 0
  );
`);

// ── Config helpers ──────────────────────────────────────────────────────────
const _get = db.prepare('SELECT value FROM config WHERE key = ?');
const _set = db.prepare(
  'INSERT INTO config (key, value) VALUES (?, ?) ' +
  'ON CONFLICT(key) DO UPDATE SET value = excluded.value'
);

function getConfig(key, fallback = null) {
  const row = _get.get(key);
  return row ? row.value : fallback;
}
function setConfig(key, value) {
  _set.run(key, String(value));
  return value;
}

module.exports = { db, getConfig, setConfig };
