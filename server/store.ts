import postgres from "postgres";
import { emptyState, type State } from "./domain.ts";
import { usesPostgres } from "./hosting.ts";

type Value = string | number;
type Row = Record<string, unknown>;
export type Store = {
  get(sql: string, ...values: Value[]): Promise<Row | undefined>;
  run(sql: string, ...values: Value[]): Promise<void>;
};
let pool: ReturnType<typeof postgres> | undefined;
let localQueue = Promise.resolve();
function connection() {
  if (!pool) {
    let url: URL;
    try { url = new URL(process.env.BORROWBUDDY_POSTGRES_URL!); }
    catch { throw new Error("Format URL PostgreSQL tidak valid."); }
    if (!["postgres:","postgresql:"].includes(url.protocol)) throw new Error("Gunakan URL koneksi PostgreSQL.");
    const local = ["127.0.0.1","localhost","[::1]"].includes(url.hostname) && !process.env.VERCEL;
    // The connection policy controls TLS, including when the copied URL contains sslmode.
    url.searchParams.delete("sslmode");
    url.searchParams.delete("ssl");
    const ca = process.env.BORROWBUDDY_POSTGRES_CA?.replace(/\\n/g,"\n");
    pool = postgres(url.href, { prepare: false, max: 1, idle_timeout: 10, connect_timeout: 10, ssl: local ? false : { rejectUnauthorized: true, ...(ca ? { ca } : {}) } });
  }
  return pool;
}

export async function withStore<T>(write: boolean, work: (store: Store) => Promise<T>): Promise<T> {
  if (usesPostgres()) {
    const result = await connection().begin(write ? "" : "isolation level repeatable read read only", async tx => {
      await tx.unsafe("SET LOCAL search_path TO borrowbuddy, pg_catalog");
      // All domain writers share one JSON snapshot; serialize read-modify-write across instances.
      if (write) await tx.unsafe("SELECT pg_advisory_xact_lock(241982013)");
      const query = (sql: string, values: Value[]) => {
        let index = 0;
        return tx.unsafe(sql.replace(/\?/g, () => "$" + ++index), values);
      };
      return { value: await work({
        get: async (sql,...values) => (await query(sql,values))[0],
        run: async (sql,...values) => { await query(sql,values); },
      }) };
    });
    return result.value;
  }
  const pending = localQueue.then(async () => {
    const { database } = await import("./database.ts");
    const db = database();
    db.exec(write ? "BEGIN IMMEDIATE" : "BEGIN");
    try {
      const value = await work({
        get: async (sql,...values) => db.prepare(sql).get(...values),
        run: async (sql,...values) => { db.prepare(sql).run(...values); },
      });
      db.exec("COMMIT");
      return value;
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  });
  localQueue = pending.then(()=>{},()=>{});
  return pending;
}
export async function loadState(store: Store): Promise<State> {
  const row = await store.get("SELECT payload FROM app_state WHERE id=1");
  return row ? JSON.parse(String(row.payload)) : emptyState();
}
export async function persistState(store: Store, state: State) {
  await store.run("INSERT INTO app_state(id,payload) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",JSON.stringify({...state,person:""}));
}
export async function closeStore() { if (pool) { await pool.end(); pool = undefined; } }
