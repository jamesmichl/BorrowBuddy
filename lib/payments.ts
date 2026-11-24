import { isPublished } from "./loans.ts";
import type { Item, Loan, Person } from "./loans.ts";

export type Promotion = {
  id: string; itemId: string; buyer: Person; price: number; days: number; createdAt: string;
  status: "pending" | "paid"; startsAt?: string; endsAt?: string;
};
export type Receipt = {
  id: string; kind: "loan" | "promotion"; payer: Person; mode: "simulation"; status: "succeeded";
  rental: number; deposit: number; service: number; commission: number; promotionRevenue: number; paidAt: string;
  servicePercent?: number; total?: number;
  owner?: Person; ownerProceeds?: number;
  serviceRefund?: { amount: number; at: string; actor: Person; reason: string };
};
export type LoanCosts = Pick<Loan, "rental" | "service" | "deposit" | "servicePercent" | "total">;
export const loanTotal = (costs: LoanCosts) => costs.total ?? (costs.rental + costs.service + costs.deposit);
export const serviceLabel = (percent?: number) => percent === undefined ? "Biaya layanan" : `Biaya layanan (${percent}%)`;

export function cashReport(receipts: Receipt[]) {
  const totals = { service: 0, promotion: 0, commission: 0, refund: 0 };
  const entries: { id: string; category: keyof typeof totals; label: string; at: string; amount: number; reason?: string }[] = [];
  for (const row of receipts) {
    if (row.status !== "succeeded" || row.mode !== "simulation") continue;
    function add(category: keyof typeof totals, label: string, amount: number, at = row.paidAt, reason?: string) {
      if (!amount) return;
      totals[category] += amount;
      entries.push({ id: row.id, category, label, at, amount, reason });
    }
    if (row.kind === "promotion") add("promotion", "Promosi", row.promotionRevenue);
    else {
      add("service", serviceLabel(row.servicePercent), row.service);
      add("commission", "Komisi sewa lama", row.commission);
      if (row.serviceRefund) add("refund", "Refund biaya layanan", -row.serviceRefund.amount, row.serviceRefund.at, row.serviceRefund.reason);
    }
  }
  entries.sort((a, b) => b.at.localeCompare(a.at));
  return { totals, entries, balance: totals.service + totals.promotion + totals.commission + totals.refund };
}
export const qrPayload = (id: string) => `BORROWBUDDY_DEMO:${id}`;

export function promotionStatus(order: Promotion, now: number): "Menunggu pembayaran" | "Terjadwal" | "Aktif" | "Berakhir" {
  if (order.status === "pending") return "Menunggu pembayaran";
  if (Date.parse(order.endsAt!) <= now) return "Berakhir";
  return Date.parse(order.startsAt!) > now ? "Terjadwal" : "Aktif";
}
export function activatePromotion(order: Promotion, orders: Promotion[], time: Date): Promotion {
  if (order.status !== "pending") throw new Error("Paket promosi ini sudah dibayar.");
  const start = orders.reduce((latest, other) => other.itemId === order.itemId && other.status === "paid"
    ? Math.max(latest, Date.parse(other.endsAt!)) : latest, time.getTime());
  return { ...order, status: "paid", startsAt: new Date(start).toISOString(), endsAt: new Date(start + order.days * 86400000).toISOString() };
}
export function activePromotions(items: Item[], orders: Promotion[], now: number) {
  const active = new Map<string, Promotion>();
  const byId = new Map(items.map((item) => [item.id, item]));
  for (const order of orders) {
    const item = byId.get(order.itemId);
    if (item && isPublished(item) && item.owner === order.buyer && promotionStatus(order, now) === "Aktif") active.set(item.id, order);
  }
  return active;
}
