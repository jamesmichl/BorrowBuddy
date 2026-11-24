import { encodePassword } from "../server/auth.ts";
import { makeSeed } from "../server/domain.ts";
import { closeStore, loadState, persistState, withStore } from "../server/store.ts";
import { onlineDemo } from "../server/hosting.ts";

if (!onlineDemo() || !process.env.BORROWBUDDY_POSTGRES_URL || process.env.VERCEL) throw new Error("Jalankan seed online secara manual dari komputer pengelola dengan mode online-demo dan URL PostgreSQL demo.");
const input = (await Array.fromAsync(process.stdin.setEncoding("utf8"))).join("");
const secrets = JSON.parse(input || "{}");
try {
  await withStore(true,async db => {
    const original = await db.get("SELECT id FROM app_state WHERE id=1");
    const state = original ? await loadState(db) : makeSeed();
    for (const id of ["raka","naya","admin"]) {
      const profile = state.accounts[id];
      if (!profile || profile.email !== id + "@borrowbuddy.test" || profile.role !== (id === "admin" ? "admin" : "student")) {
        throw new Error("Gunakan schema demo baru atau database demo yang sudah di-seed. Data yang ada dipertahankan.");
      }
      const identity = await db.get("SELECT email FROM identities WHERE id=?",id);
      if (identity) {
        if (identity.email !== profile.email) throw new Error("Identitas tidak cocok dengan profil demo.");
        continue;
      }
      if (typeof secrets[id] !== "string" || secrets[id].length < 12 || secrets[id].length > 128) throw new Error("Sediakan password baru 12–128 karakter untuk " + id + " melalui stdin.");
      await db.run("INSERT INTO identities VALUES(?,?,?)",id,profile.email,encodePassword(secrets[id]));
    }
    if (!original) await persistState(db,state);
  });
  console.log("Akun dan katalog contoh siap di PostgreSQL.");
} finally { await closeStore(); }
