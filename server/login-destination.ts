import { isPublished } from "../lib/loans.ts";
import { loanTotal } from "../lib/payments.ts";
import type { View } from "./domain.ts";

export function loginDestination(target: unknown, view: View): string {
  const admin = view.profile?.role === "admin";
  const fallback = admin ? "/admin" : "/";
  if (typeof target !== "string" || !target.startsWith("/") || /[^/A-Za-z0-9_-]/.test(target)) return fallback;
  const student = view.profile?.role === "student";
  const verified = student && view.verificationStatus === "approved";
  switch (target) {
    case "/": case "/profil": case "/transaksi": return target;
    case "/admin": return admin ? target : fallback;
    case "/verifikasi": return student ? target : fallback;
    case "/pasang": return verified ? target : fallback;
  }
  const parts = target.slice(1).split("/");
  if (parts.includes("") || parts.length > 3) return fallback;
  const [page, id, action] = parts;
  if (page === "barang") {
    const item = view.items.find(item => item.id === id);
    if (!item) return fallback;
    const owner = item.owner === view.person;
    if (!action && (admin || isPublished(item) || owner)) return target;
    if (!verified) return fallback;
    if (action === "edit" && owner && !item.archivedAt && !item.moderation?.length) return target;
    if (action === "ajukan" && !owner && item.bookingReady && isPublished(item)) return target;
    if (action === "promosikan" && owner && isPublished(item)) return target;
  }
  if (page === "transaksi" && !action && view.loans.some(l => l.id === id)) return target;
  if (page === "pembayaran" && action) {
    if (id === "peminjaman" && view.loans.some(l => l.id === action && l.borrower === view.person && loanTotal(l) > 0 &&
      (l.status === "approved" || l.history.paid))) return target;
    if (id === "promosi" && view.promotions.some(p => p.id === action && p.buyer === view.person &&
      view.items.some(i => i.id === p.itemId && i.owner === view.person && (isPublished(i) || p.status === "paid")))) return target;
  }
  return fallback;
}
