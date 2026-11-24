import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { isDeepStrictEqual as equal } from "node:util";
import { exampleAccounts, normalizeEmail } from "../lib/accounts.ts";
import { atomic, database, readState, writeState } from "../server/database.ts";
import { emptyState, type State } from "../server/domain.ts";

if (process.env.NODE_ENV === "production" || process.env.BORROWBUDDY_DEMO_SEED !== "1" || !process.argv[2]) throw new Error("Aktifkan migrasi demo dan berikan path ekspor JSON tepercaya.");
const raw = readFileSync(process.argv[2], "utf8").replace(/^\uFEFF/, "");
const incoming = JSON.parse(raw);
if (!Array.isArray(incoming.items) || !Array.isArray(incoming.loans)) throw new Error("Format ekspor tidak dikenali.");
const key = "import-" + createHash("sha256").update(raw).digest("hex");
atomic(() => {
  const db = database();
  if (db.prepare("SELECT key FROM migrations WHERE key=?").get(key)) return;
  const current = readState();
  const row = db.prepare("SELECT value FROM migrations WHERE key='seed-baseline'").get();
  const base: State = row ? JSON.parse(String(row.value)) : emptyState();
  for (const id of ["raka","naya"]) {
    if (base.accounts[id] && current.accounts[id]?.demoLoanAccess) base.accounts[id].demoLoanAccess = true;
  }
  function merge<T>(current: Record<string,T>, imported: Record<string,T>, baseline: Record<string,T>) {
    for (const [id,value] of Object.entries(imported)) {
      if (Object.hasOwn(Object.prototype,id)) throw new Error("ID tidak valid.");
      if (Object.hasOwn(current,id) && !equal(current[id],value) && !equal(current[id],baseline[id])) throw new Error("Konflik data pada ID " + id + ". Impor dibatalkan.");
      current[id] = value;
    }
    return current;
  }
  function rows<T extends { id: string; kind?: string }>(target: T[], source: T[], baseline: T[]) {
    const map = (arr: T[]) => Object.fromEntries(arr.map(v => [(v.kind ?? "") + ":" + v.id, v]));
    return Object.values(merge(map(target),map(source),map(baseline)));
  }
  const old: State = { ...emptyState(), ...incoming };
  for (const item of old.items) {
    if (!Object.hasOwn(old.valuations,item.id) && current.valuations[item.id] === base.valuations[item.id]) delete current.valuations[item.id];
  }
  for (const [id, account] of Object.entries(old.accounts)) {
    const demo = Object.hasOwn(exampleAccounts,id) ? exampleAccounts[id] : undefined;
    const email = demo?.email ?? normalizeEmail(account.email);
    if (!demo) {
      const credential = account.credential;
      if (!credential || !/^[a-f0-9-]{36}$/i.test(credential.salt) || !/^[a-f0-9]{64}$/i.test(credential.digest)) throw new Error("Kredensial lama tidak dikenali. Impor dibatalkan.");
      db.prepare("INSERT INTO identities VALUES(?,?,?)").run(id,email,"legacy-pbkdf2:" + credential.salt + ":" + credential.digest);
    }
    old.accounts[id] = { name: account.name, email, role: demo?.role ?? "student", confirmed: !!demo, ...(demo ? { example: true } : {}), ...(current.accounts[id]?.demoLoanAccess ? { demoLoanAccess: true } : {}), ...(account.campus ? {campus:account.campus} : {}) };
  }
  writeState({
    person: "", accounts: merge(current.accounts,old.accounts,base.accounts),
    items: rows(current.items,old.items,base.items), loans: rows(current.loans,old.loans,base.loans),
    promotions: rows(current.promotions,old.promotions,base.promotions), receipts: rows(current.receipts,old.receipts,base.receipts),
    verifications: merge(current.verifications,old.verifications,base.verifications), valuations: merge(current.valuations,old.valuations,base.valuations),
  });
  db.prepare("INSERT INTO migrations VALUES(?,?)").run(key,new Date().toISOString());
});
console.log("Ekspor sudah dimigrasikan.");
