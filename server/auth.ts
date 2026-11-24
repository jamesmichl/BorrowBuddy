import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual, pbkdf2Sync } from "node:crypto";
import { normalizeEmail, signupInput } from "../lib/accounts.ts";
import { loadState, persistState, withStore, type Store } from "./store.ts";
import { onlineDemo } from "./hosting.ts";
import { developmentEmailAllowed, emailDelivery } from "./email-delivery.ts";

export const cookieName = "bb_session";
export const lifetime = 7 * 86400;
export const demoEmailLifetime = 15 * 60;
export const demoEmailCookie = "bb_email_registration";
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
export function encodePassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
function matches(password: string, secret: string) {
  const [algorithm, salt, digest] = secret.split(":");
  const actual = algorithm === "legacy-pbkdf2" ? pbkdf2Sync(password, salt, 210000, 32, "sha256") : scryptSync(password, salt, 64);
  const expected = Buffer.from(digest, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export async function sessionActor(store: Store, token?: string) {
  if (!token || token.length !== 64) return "";
  const digest = hash(token);
  const row = await store.get("SELECT account FROM sessions WHERE (hash=? OR (hash=? AND CAST(? AS integer)=1)) AND expires>?",digest, "demo:" + digest, Number(developmentEmailAllowed()), Date.now());
  return row ? String(row.account) : "";
}
export const actorFor = (token?: string) => token ? withStore(false,store => sessionActor(store,token)) : Promise.resolve("");
async function deleteSession(store: Store, token?: string) {
  if (token) await store.run("DELETE FROM sessions WHERE hash IN (?,?)",hash(token),"demo:" + hash(token));
}
export const revoke = (token?: string) => withStore(true,store => deleteSession(store,token));
export async function signIn(email: string, password: string, previous?: string) {
  email = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !password || password.length > 128) throw new Error("Isi email dan password yang valid.");
  const session = await withStore(true,async db => {
    const now = Date.now();
    const attempt = await db.get("SELECT count FROM attempts WHERE email=? AND expires>?",email,now);
    if (Number(attempt?.count ?? 0) >= 12) throw new Error("Terlalu banyak percobaan. Coba lagi dalam 10 menit.");
    const identity = await db.get("SELECT id,secret FROM identities WHERE email=?",email);
    const valid = matches(password, String(identity?.secret ?? "scrypt:absent:" + "0".repeat(128)));
    if (!identity || !valid) {
      await db.run("INSERT INTO attempts VALUES(?,1,?) ON CONFLICT(email) DO UPDATE SET count=CASE WHEN attempts.expires<=? THEN 1 ELSE attempts.count+1 END, expires=excluded.expires",email,now+600000,now);
      return null;
    }
    const id = String(identity.id);
    const profile = (await loadState(db)).accounts[id];
    if (!profile?.confirmed || (profile.demoEmail && !developmentEmailAllowed())) throw new Error("Konfirmasi email sebelum masuk.");
    await db.run("DELETE FROM attempts WHERE email=?",email);
    await db.run("DELETE FROM sessions WHERE expires<=?",now);
    await deleteSession(db,previous);
    const token = randomBytes(32).toString("hex");
    await db.run("INSERT INTO sessions VALUES(?,?,?)",(profile.demoEmail ? "demo:" : "") + hash(token),id,now+lifetime*1000);
    return {token,id,role:profile.role};
  });
  if (!session) throw new Error("Email atau password tidak sesuai.");
  return session;
}
async function registerPending(name: string, email: string, password: string, confirmation: string, browserProof?: string) {
  const input = signupInput(name,email,password,confirmation,onlineDemo());
  return withStore(true,async db => {
    const state = await loadState(db);
    const existing = await db.get("SELECT id,secret FROM identities WHERE email=?",input.email);
    const id = existing ? String(existing.id) : randomUUID();
    if (existing) {
      const account = state.accounts[id];
      const canRetry = browserProof ? account?.demoEmail && !account.confirmed : !account?.confirmed || account.demoEmail;
      if (!canRetry || !matches(password,String(existing.secret))) throw new Error("Email ini sudah terdaftar.");
    } else {
      await db.run("INSERT INTO identities VALUES(?,?,?)",id,input.email,encodePassword(password));
      state.accounts[id] = { ...input,confirmed:false,role:"student",...(browserProof ? { demoEmail:true as const } : {}) };
      await persistState(db,state);
    }
    const token = randomBytes(32).toString("hex");
    const digest = browserProof ? "demo:" + hash(browserProof + token) : hash(token);
    await db.run("INSERT INTO confirmations VALUES(?,?,?) ON CONFLICT(account) DO UPDATE SET hash=excluded.hash,expires=excluded.expires",digest,id,Date.now()+(browserProof ? demoEmailLifetime*1000 : 86400000));
    return token;
  });
}
export function register(name: string,email: string,password: string,confirmation: string) {
  return registerPending(name,email,password,confirmation);
}
export async function registerDemoEmail(name: string,email: string,password: string,confirmation: string) {
  if (emailDelivery().mode !== "demo") throw new Error("Konfirmasi demo tidak tersedia.");
  const proof = randomBytes(32).toString("hex");
  return { ticket:await registerPending(name,email,password,confirmation,proof),proof };
}
function completeConfirmation(digest: string,demo: boolean) {
  return withStore(true,async db => {
    const row = await db.get("SELECT account FROM confirmations WHERE hash=? AND expires>?",digest,Date.now());
    if (!row) throw new Error("Tautan konfirmasi tidak valid atau sudah kedaluwarsa.");
    const state = await loadState(db);
    const account = state.accounts[String(row.account)];
    if (demo && !account.demoEmail) throw new Error("Konfirmasi demo tidak tersedia.");
    account.confirmed = true;
    if (!demo) delete account.demoEmail;
    await persistState(db,state);
    await db.run("DELETE FROM confirmations WHERE hash=?",digest);
  });
}
export function confirmEmail(token: string) {
  return completeConfirmation(hash(token),false);
}
export async function confirmDemoRegistration(ticket: string, proof?: string) {
  if (emailDelivery().mode !== "demo") throw new Error("Konfirmasi demo tidak tersedia.");
  if (!proof || !/^[a-f0-9]{64}$/.test(proof) || !/^[a-f0-9]{64}$/.test(ticket)) throw new Error("Buka konfirmasi demo pada browser tempat Anda mendaftar.");
  await completeConfirmation("demo:" + hash(proof+ticket),true);
}
