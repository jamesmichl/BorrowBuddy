import assert from "node:assert/strict";
import { test } from "node:test";
import { domain, makeSeed } from "../server/domain.ts";
import { loginDestination } from "../server/login-destination.ts";
import { loginPath } from "../lib/login-path.ts";

test("tujuan login mengikuti peran, verifikasi, kepemilikan, dan kondisi listing", () => {
  process.env.BORROWBUDDY_DEMO_SEED = "1";
  const state = makeSeed();
  state.accounts.baru = { name: "Mahasiswa Uji", email: "uji@binus.ac.id", confirmed: true, role: "student" };
  const target = (actor: string, next?: unknown) => loginDestination(next, domain(state, actor, () => {}).view());
  assert.equal(target("raka"), "/");
  assert.equal(target("admin"), "/admin");
  assert.equal(target("baru"), "/");
  for (const path of ["/pasang", "/barang/hdmi/ajukan", "/admin"]) assert.equal(target("baru", path), "/");
  for (const path of ["/profil", "/verifikasi", "/barang/hdmi"]) assert.equal(target("baru", path), path);
  assert.equal(target("raka", "/pasang"), "/pasang");
  assert.equal(target("raka", "/barang/hdmi/ajukan"), "/barang/hdmi/ajukan");
  assert.equal(target("raka", "/barang/hdmi/edit"), "/");
  assert.equal(target("naya", "/barang/hdmi/edit"), "/barang/hdmi/edit");
  assert.equal(target("admin", "/transaksi/demo-stand"), "/transaksi/demo-stand");
  assert.equal(target("admin", "/transaksi/tidak-ada"), "/admin");
  assert.equal(target("raka", "/transaksi/demo-stand"), "/transaksi/demo-stand");
  assert.equal(target("baru", "/transaksi/demo-stand"), "/");
  assert.equal(target("admin", "/pasang"), "/admin");
  assert.equal(target("raka", "/admin"), "/");
  assert.equal(target("admin", "/barang/hdmi"), "/barang/hdmi");
  state.items = state.items.map(item => item.id === "hdmi" ? { ...item, active: false } : item);
  assert.equal(target("admin", "/barang/hdmi"), "/barang/hdmi");
  assert.equal(target("raka", "/barang/hdmi"), "/");
  for (const path of ["https://example.org", "//example.org", "/api/session", "/barang/missing", "/masuk", ["/profil","/admin"]]) {
    assert.equal(target("raka", path), "/");
  }
  assert.equal(new URL(loginPath("/barang/hdmi"), "http://localhost").searchParams.get("next"), "/barang/hdmi");
});
