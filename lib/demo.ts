"use client";

import type { domain, View } from "../server/domain";
import type { Receipt } from "./payments";

type Screen = View & { ready: boolean; error?: string };
const empty: Screen = {
  ready: false, person: "", items: [], loans: [], busyItemIds: [], profile: undefined, names: {},
  verificationStatus: "none", demoVerification: false, onlineDemo: false, promotions: [], promotionWindows: [], valuations: {}, document: undefined, receipts: [], admin: undefined,
};
let current = empty;
let generation = 0;
const listeners = new Set<() => void>();
let channel: BroadcastChannel | undefined;
function publish(next: Screen) {
  current = next;
  for (const listener of listeners) listener();
}
function clear() { generation++; publish(empty); }
async function refresh() {
  const version = ++generation;
  try {
    const response = await fetch("/api/session", { cache: "no-store" });
    if (!response.ok) throw new Error();
    const { view } = await response.json();
    if (generation === version) publish({ ...view, ready: true });
  } catch {
    if (generation === version) publish({ ...empty, error: "Gagal memuat sesi. Muat ulang halaman untuk mencoba kembali." });
  }
}
function restore(event: PageTransitionEvent) {
  if (event.persisted) { clear(); void refresh(); }
  document.documentElement.style.visibility = "";
}
function hide() { document.documentElement.style.visibility = "hidden"; clear(); }
function onVisibility() { if (document.visibilityState === "visible") void refresh(); }
export function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("borrowbuddy-session") : undefined;
    if (channel) channel.onmessage = () => { clear(); window.location.reload(); };
    window.addEventListener("pageshow", restore);
    window.addEventListener("pagehide", hide);
    document.addEventListener("visibilitychange", onVisibility);
    void refresh();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      channel?.close(); channel = undefined;
      window.removeEventListener("pageshow", restore);
      window.removeEventListener("pagehide", hide);
      document.removeEventListener("visibilitychange", onVisibility);
      clear();
    }
  };
}
export const snapshot = () => current;
export const serverSnapshot = () => empty;
async function call<T>(op: string, args: unknown[]) {
  const actor = current.person;
  const version = generation;
  const response = await fetch("/api/session", {
    method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op, args, expectedActor: actor }),
  }).catch(() => { throw new Error("Server tidak dapat dihubungi. Periksa koneksi lalu coba lagi."); });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 || response.status === 409) { clear(); void refresh(); }
    throw new Error(data.error || "Permintaan gagal.");
  }
  if (op === "login" || op === "logout") { clear(); channel?.postMessage("session"); }
  else if (data.view && current.person === actor) {
    if (version === generation) { generation++; publish({ ...data.view, ready: true }); }
    else await refresh();
  }
  return data.result as T;
}
type Repo = ReturnType<typeof domain>;
function action<K extends keyof Repo>(name: K) {
  return (...args: Parameters<Repo[K]>) => call<ReturnType<Repo[K]>>(name, args);
}
export const updateProfile = action("updateProfile");
export const submitVerification = (nim: string, campus: string, photo: string) => call("submitVerification", [nim,campus,photo]);
export const reviewVerification = action("reviewVerification");
export const addItem = action("addItem");
export const removeListing = action("removeListing");
export const requestLoan = action("requestLoan");
export const changeStatus = action("changeStatus");
export const refundServiceFee = action("refundServiceFee");
export const createPromotion = action("createPromotion");
export const listingValuation = (id: string) => current.valuations[id];
export const verificationDocument = (id: string) => id === current.person ? current.document : undefined;
export const adminRecords = () => { if (!current.admin) throw new Error("Akses ditolak."); return current.admin; };
export const paymentReceipt = (kind: Receipt["kind"], id: string) => current.receipts.find(row => row.kind === kind && row.id === id);
export const confirmSimulatedPayment = (kind: Receipt["kind"], id: string) => call<Receipt>("confirmPayment", [kind,id]);
export const login = (email: string, password: string) => call<"student"|"admin">("login", [email,password]);
export const logout = () => call("logout", []);
type SignupResult = { mode: "demo"; ticket: string } | { mode: "sent" };
export const signup = (name: string, email: string, password: string, confirmation: string) => call<SignupResult>("signup", [name,email,password,confirmation]);
export const confirmEmail = (token: string) => call("confirmEmail",[token]);
export const confirmDemoRegistration = (ticket: string) => call("confirmDemoRegistration",[ticket]);
