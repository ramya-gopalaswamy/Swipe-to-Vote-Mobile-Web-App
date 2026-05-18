import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { DatabaseSync } from 'node:sqlite'
import { seedCatalogIfEmpty } from './seedCatalog.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

dotenv.config({ path: path.join(rootDir, '.env') })
dotenv.config({ path: path.join(rootDir, '.env.local'), override: true })

const rawPath = process.env.SQLITE_PATH || path.join(rootDir, 'data', 'galaswipe.db')
const dbPath = path.isAbsolute(rawPath) ? rawPath : path.join(rootDir, rawPath)

fs.mkdirSync(path.dirname(dbPath), { recursive: true })

const db = new DatabaseSync(dbPath)

db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA foreign_keys = ON')

db.exec(`
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  choice TEXT NOT NULL CHECK (choice IN ('yes', 'no')),
  decision_time_ms INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (session_id, item_id),
  FOREIGN KEY (item_id) REFERENCES items (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS votes_item_id_idx ON votes (item_id);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
`)

const voteCols = db.prepare(`PRAGMA table_info(votes)`).all()
if (!voteCols.some((c) => c.name === 'decision_time_ms')) {
  db.exec(`ALTER TABLE votes ADD COLUMN decision_time_ms INTEGER`)
}

seedCatalogIfEmpty(db)

export default db
