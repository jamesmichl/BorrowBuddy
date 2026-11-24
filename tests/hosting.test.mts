import assert from "node:assert/strict";
import { test } from "node:test";
import { signupInput } from "../lib/accounts.ts";
import { demoVerificationEnabled } from "../server/demo-mode.ts";
import { emailDelivery } from "../server/email-delivery.ts";
import { onlineDemo, usesPostgres } from "../server/hosting.ts";
import { inspectPhoto } from "../server/ocr.ts";

test("Vercel memerlukan mode eksplisit dan PostgreSQL, tanpa fallback SQLite", () => {
  const env = { ...process.env };
  try {
    process.env.VERCEL = "1";
    delete process.env.BORROWBUDDY_MODE;
    delete process.env.BORROWBUDDY_POSTGRES_URL;
    assert.throws(usesPostgres, /online-demo/);
    process.env.BORROWBUDDY_MODE = "online-demo";
    assert.throws(usesPostgres, /PostgreSQL/);
    process.env.BORROWBUDDY_POSTGRES_URL = "postgres://db.invalid/demo";
    assert.equal(usesPostgres(), true);
  } finally { process.env = env; }
});

test("build produksi dengan mode online-demo hanya menerima identitas dan kartu sintetis", async () => {
  const env = { ...process.env };
  try {
    Object.assign(process.env, { NODE_ENV: "production", BORROWBUDDY_MODE: "online-demo" });
    assert.equal(demoVerificationEnabled(), true);
    assert.equal(emailDelivery().mode, "demo");
    const signup = (email: string) => signupInput("Penguji",email,"test-secret","test-secret",onlineDemo());
    assert.equal(signup("uji@student.borrowbuddy.test").email, "uji@student.borrowbuddy.test");
    assert.throws(() => signup("uji@binus.ac.id"), /fiktif/);
    assert.throws(() => signup("admin@borrowbuddy.test"), /fiktif/);
    await assert.rejects(inspectPhoto("1234567890","data:image/png;base64,AA=="), /sintetis/);
    delete process.env.BORROWBUDDY_MODE;
    assert.equal(demoVerificationEnabled(), false);
    assert.notEqual(emailDelivery().mode, "demo");
  } finally { process.env = env; }
});

