import type { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { emptyState, type State } from "./domain.ts";

let connection: DatabaseSync | undefined;
export function database() {
  if (process.env.VERCEL || process.env.BORROWBUDDY_MODE === "online-demo" || process.env.BORROWBUDDY_POSTGRES_URL) throw new Error("SQLite hanya tersedia pada instalasi lokal.");
  if (connection) return connection;
  const { DatabaseSync } = process.getBuiltinModule("node:sqlite");
  const path = resolve(/* turbopackIgnore: true */ process.env.BORROWBUDDY_DB ?? ".borrowbuddy/local.sqlite");
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA busy_timeout=5000;
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS app_state(id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS identities(id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL COLLATE NOCASE, secret TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY, account TEXT NOT NULL REFERENCES identities(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS confirmations(hash TEXT PRIMARY KEY, account TEXT UNIQUE NOT NULL REFERENCES identities(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS attempts(email TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS migrations(key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  connection = db;
  return db;
}
export function readState(): State {
  const row = database().prepare("SELECT payload FROM app_state WHERE id=1").get();
  return row ? JSON.parse(String(row.payload)) : emptyState();
}
export function writeState(state: State) {
  database().prepare("INSERT INTO app_state VALUES(1,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload").run(JSON.stringify({ ...state, person: "" }));
}
export function atomic<T>(work: () => T) {
  const db = database();
  db.exec("BEGIN IMMEDIATE");
  try { const result = work(); db.exec("COMMIT"); return result; }
  catch (error) { db.exec("ROLLBACK"); throw error; }
}
