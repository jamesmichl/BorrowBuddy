import { campuses, locationFor } from "./locations.ts";
import { demoConfig } from "./config.ts";
export { campuses };
export const people = {
  raka: { name: "Raka Pratama", initials: "RP", rating: 4.8 },
  naya: { name: "Naya Putri", initials: "NP", rating: 4.9 },
} as const;
export type Person = string;
export function depositFor(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error("Estimasi nilai barang harus berupa Rupiah bulat positif.");
  return Math.round(value / 2);
}
export const categories = ["Elektronik", "Perlengkapan Kuliah", "Perlengkapan Acara"] as const;
export type Item = {
  id: string; name: string; category: typeof categories[number]; campus: typeof campuses[number];
  owner: Person; description: string; condition: string; contents: string;
  points: string[]; rate: number; deposit: number; maxDays: number; photo?: string; tile?: number; active?: boolean;
  photos?: string[]; archivedAt?: string; bookingReady?: boolean;
  moderation?: { actor: Person; at: string; reason: string; action: "hide" | "archive" }[];
};
export function listingPhotos(item: Pick<Item, "photos" | "photo" | "tile">) {
  const legacy = item.photo ? [item.photo] : item.tile !== undefined ? ["tile:" + item.tile] : [];
  return (item.photos ?? legacy).filter((src) => {
    if (/^tile:[0-5]$/.test(src)) return true;
    if (src.startsWith("data:image/jpeg;base64,/9j/") || src.startsWith("data:image/png;base64,iVBORw0KGgo")) return true;
    if (!src.startsWith("data:image/webp;base64,UklGR")) return false;
    try {
      const header = atob(src.slice(23, 39));
      return header.startsWith("RIFF") && header.endsWith("WEBP");
    } catch { return false; }
  });
}
export const isPublished = (item: Item) => !item.archivedAt && item.active !== false && listingPhotos(item).length > 0;
export function hasOpenLoans(itemId: string, loans: Loan[]) {
  return loans.some((loan) => loan.itemId === itemId && !["rejected", "cancelled", "completed"].includes(loan.status));
}
export const steps = ["Permintaan diajukan", "Disetujui", "Pembayaran simulasi", "Serah terima", "Sedang dipinjam", "Pengembalian", "Selesai"] as const;
export const statuses = ["requested", "approved", "paid", "handover", "active", "returning", "completed"] as const;
export type Status = typeof statuses[number] | "rejected" | "cancelled";
export type Loan = {
  id: string; itemId: string; owner: Person; borrower: Person;
  start: string; end: string; point: string; pointId?: string; status: Status;
  rental: number; service: number; deposit: number; history: Partial<Record<Status, string>>;
  days?: number;
  servicePercent?: number; total?: number; // Absent on orders created before fee snapshots.
};
export const stepIndex = (status: Status) => statuses.findIndex((value) => value === status);
export const statusLabel = (status: Status) => status === "rejected" ? "Ditolak" : status === "cancelled" ? "Dibatalkan" : steps[stepIndex(status)];
export const rupiah = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
export const dateLabel = (value: string) => {
  const date = new Date(value.length === 16 ? value + ":00+07:00" : value);
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(date) + " WIB";
};
export function jakartaInput(now = new Date()) {
  return new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 16);
}
export function filterItems(items: Item[], query: string, category: string, campus: string, price: string) {
  const keyword = query.trim().toLocaleLowerCase("id");
  return items.filter((item) => isPublished(item) &&
    [item.name, item.description, item.category, item.campus].join(" ").toLocaleLowerCase("id").includes(keyword)
    && (!category || item.category === category) && (!campus || item.campus === campus)
    && (!price || (price === "free" ? item.rate === 0 : item.rate > 0)));
}
export const loanDays = (start: string, end: string) => Math.ceil((Date.parse(end + ":00Z") - Date.parse(start + ":00Z")) / 86400000);
export function quote(item: Item, start: string, end: string) {
  const days = Math.max(0, loanDays(start, end) || 0);
  const rental = item.rate * days;
  const { servicePercent } = demoConfig;
  const service = Math.round(rental * servicePercent / 100);
  return { days, rental, servicePercent, service, deposit: item.deposit, total: rental + service + item.deposit };
}
const reserves = (status: Status) => ["requested", "approved", "paid", "handover", "active", "returning"].includes(status);

export function validateRequest(item: Item, loans: Loan[], borrower: Person, start: string, end: string, point: string, now = jakartaInput()) {
  if (borrower === item.owner) return "Barang ini milik akun yang sedang aktif.";
  if (!Number.isFinite(loanDays(start, end)) || end <= start) return "Waktu pengembalian harus setelah waktu mulai.";
  if (start < now) return "Waktu mulai sudah lewat.";
  if (loanDays(start, end) > item.maxDays) return `Durasi maksimal ${item.maxDays} hari.`;
  if (!item.points.includes(point) || !locationFor(item.campus, point)) return "Pilih titik serah terima yang tersedia.";
  if (loans.some((loan) => loan.itemId === item.id && reserves(loan.status) && start < loan.end && end > loan.start)) return "Jadwal ini berbenturan dengan permintaan atau peminjaman lain.";
  return "";
}

const transitions: Partial<Record<Status, { actor: "owner" | "borrower"; next: Status; label: string }[]>> = {
  requested: [{ actor: "owner", next: "approved", label: "Setujui permintaan" }, { actor: "owner", next: "rejected", label: "Tolak permintaan" }],
  approved: [{ actor: "borrower", next: "paid", label: "Bayar simulasi" }],
  paid: [{ actor: "owner", next: "handover", label: "Konfirmasi barang diserahkan" }],
  handover: [{ actor: "borrower", next: "active", label: "Konfirmasi barang diterima" }],
  active: [{ actor: "borrower", next: "returning", label: "Konfirmasi barang dikembalikan" }],
  returning: [{ actor: "owner", next: "completed", label: "Barang sesuai, selesaikan" }],
};
export function actionsFor(loan: Loan, person: Person) {
  const actions = (transitions[loan.status] ?? []).filter((action) => loan[action.actor] === person);
  if (["requested", "approved", "paid"].includes(loan.status) && [loan.owner, loan.borrower].includes(person)) {
    actions.push({ actor: person === loan.owner ? "owner" : "borrower", next: "cancelled", label: "Batalkan transaksi" });
  }
  return actions;
}
export function advance(loan: Loan, person: Person, next: Status, time = new Date().toISOString()) {
  if (!actionsFor(loan, person).some((action) => action.next === next)) throw new Error("Aksi ini tidak tersedia untuk akun atau status saat ini.");
  return { ...loan, status: next, history: { ...loan.history, [next]: time } };
}
export function depositState(loan: Loan) {
  if (!loan.deposit) return "Tanpa deposit";
  if (!loan.history.paid) return "Deposit belum dibayar";
  if (loan.status === "completed" || loan.status === "cancelled") return "Deposit dikembalikan 100% (simulasi)";
  return "Deposit ditahan sementara (simulasi)";
}
