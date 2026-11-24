import { exampleAccounts } from "../lib/accounts.ts";
import { encodePassword } from "../server/auth.ts";
import { database, atomic, readState, writeState } from "../server/database.ts";
import { makeSeed } from "../server/domain.ts";

if (process.env.NODE_ENV === "production" || process.env.BORROWBUDDY_DEMO_SEED !== "1") throw new Error("Aktifkan seed hanya pada lingkungan demo lokal.");
const rotate = process.argv.includes("--rotate-passwords");
const raw = await Array.fromAsync(process.stdin.setEncoding("utf8"));
const secrets = JSON.parse(raw.join("") || "{}");
atomic(() => {
  const db = database();
  let state = readState();
  if (!db.prepare("SELECT id FROM app_state LIMIT 1").get()) {
    state = makeSeed();
    db.prepare("INSERT INTO migrations VALUES('seed-baseline',?)").run(JSON.stringify(state));
  }
  for (const [id, profile] of Object.entries(exampleAccounts)) {
    const existing = db.prepare("SELECT id FROM identities WHERE id=?").get(id);
    if (!existing || rotate) {
      const password = secrets[id];
      if (typeof password !== "string" || password.length < 8 || password.length > 128) throw new Error("Sediakan password seed melalui stdin untuk " + id);
      db.prepare("INSERT INTO identities VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET secret=excluded.secret,email=excluded.email").run(id, profile.email, encodePassword(password));
      if (rotate) db.prepare("DELETE FROM sessions WHERE account=?").run(id);
    }
    state.accounts[id] = { ...profile, ...state.accounts[id], email: profile.email, confirmed: true, role: profile.role };
    if (id === "raka" || id === "naya") state.accounts[id].demoLoanAccess = true;
  }
  if (process.argv.includes("--with-ocr-tester")) {
    const id = "ocr-tester";
    const email = "uji-ocr@borrowbuddy.test";
    if (!state.accounts[id]) {
      const password = secrets.tester;
      if (typeof password !== "string" || password.length < 8 || password.length > 128) throw new Error("Sediakan password akun uji melalui field tester pada stdin.");
      db.prepare("INSERT INTO identities VALUES(?,?,?)").run(id,email,encodePassword(password));
      state.accounts[id] = { name: "Penguji OCR", email, confirmed: true, role: "student" };
    }
  }
  writeState(state);
});
console.log("Tiga identitas demo siap.");
