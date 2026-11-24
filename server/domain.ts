import { campusLocations, locationFor, locationFromName, migratePoints, validPoints } from "../lib/locations.ts";
import { hasOpenLoans, listingPhotos, isPublished } from "../lib/loans.ts";
import { depositFor, advance, jakartaInput, quote, validateRequest, type Item, type Loan, type Person, type Status } from "../lib/loans.ts";
import { canSubmitVerification, exampleAccounts, validateVerification, type Account, type Campus, type OcrCheck, type Verification, type VerificationStatus } from "../lib/accounts.ts";
import { demoVerificationEnabled } from "./demo-mode.ts";
import { onlineDemo } from "./hosting.ts";
import { demoConfig, catalogPhotoCapacity } from "../lib/config.ts";
import { activatePromotion, loanTotal, type Promotion, type Receipt } from "../lib/payments.ts";

export type State = {
  valuations: Record<string, number>;
  person: Person; items: Item[]; loans: Loan[]; accounts: Record<Person, Account>;
  verifications: Record<Person, Verification[]>; promotions: Promotion[]; receipts: Receipt[];
};
const defaults = { valuations: {}, accounts: exampleAccounts, verifications: {}, promotions: [], receipts: [] };
function item(id: string, name: string, category: Item["category"], campus: Item["campus"], rate: number, tile: number, description: string, contents: string, owner: Person = "naya"): Item {
  return {
    id, name, category, campus, rate, deposit: depositFor(seedValuations[id]), tile, description, contents, owner,
    maxDays: category === "Perlengkapan Acara" ? 2 : 3,
    condition: "Baik, siap dipakai",
    points: campusLocations(campus).map((place) => place.id),
  };
}
// Estimasi fiktif hanya untuk katalog demo yang baru dibuat.
const seedValuations: Record<string, number> = { hdmi: 40000, charger: 60000, stand: 50000, calculator: 30000, tripod: 80000, coat: 100000 };
const seedItems = [
  item("hdmi", "Kabel HDMI 2 Meter", "Elektronik", "Kemanggisan", 0, 0, "Kabel HDMI untuk presentasi kelas, monitor, atau proyektor. Mendukung 4K 60 Hz.", "Kabel HDMI dan pengikat kabel"),
  item("charger", "Charger USB-C 65W", "Elektronik", "Alam Sutera", 10000, 1, "Adaptor pengisian daya USB-C untuk laptop dan ponsel yang mendukung Power Delivery.", "Adaptor dan kabel USB-C"),
  item("stand", "Stand Laptop Aluminium", "Perlengkapan Kuliah", "Kemanggisan", 8000, 2, "Penyangga laptop lipat dengan ketinggian yang bisa disesuaikan.", "Stand lipat dan kantong kain"),
  item("calculator", "Kalkulator Scientific", "Perlengkapan Kuliah", "Bekasi", 5000, 3, "Kalkulator ilmiah untuk latihan, praktikum, dan tugas kampus.", "Kalkulator, baterai dan penutup"),
  item("tripod", "Tripod Kamera Portabel", "Perlengkapan Acara", "Senayan", 15000, 4, "Tripod ringan untuk dokumentasi acara dan proyek kampus.", "Tripod, pelat kamera dan tas", "raka"),
  item("coat", "Jas Lab Putih", "Perlengkapan Kuliah", "Alam Sutera", 0, 5, "Jas lab bersih ukuran M untuk praktikum.", "Jas lab ukuran M", "raka"),
];
export const makeSeed = (): State => {
  const now = new Date();
  const start = jakartaInput(new Date(now.getTime() - 3600000));
  const end = jakartaInput(new Date(now.getTime() + 86400000));
  const history = Object.fromEntries(["requested", "approved", "paid", "handover", "active"].map((status, index) => [status, new Date(now.getTime() - (5 - index) * 900000).toISOString()]));
  const { days, rental, deposit } = quote(seedItems[2], start, end);
  return { ...defaults, accounts: { ...exampleAccounts, raka: { ...exampleAccounts.raka, demoLoanAccess: true }, naya: { ...exampleAccounts.naya, demoLoanAccess: true } }, valuations: { ...seedValuations }, person: "", items: seedItems, loans: [{
    id: "demo-stand", itemId: "stand", owner: "naya", borrower: "raka", start, end, pointId: seedItems[2].points[0], point: locationFor(seedItems[2].campus, seedItems[2].points[0])!.name,
    status: "active", history, days, rental, deposit, service: 0,
  }] };
};

export function emptyState(): State {
  return { accounts: {}, person: "", items: [], loans: [], receipts: [], valuations: {}, promotions: [], verifications: {} };
}

export function domain(initial: State, actor: string, persist: (next: State) => void) {
  let state = { ...initial, person: actor };
  const read = () => state;
  function save(next: State) {
    state = next;
    persist({ ...next, person: "" });
  }
  state.items = state.items.map((item) => {
    const points = migratePoints(item.campus, item.points);
    const value = state.valuations[item.id];
    const valued = Number.isSafeInteger(value) && value > 0;
    return { ...item, points, deposit: valued ? depositFor(value) : item.deposit, bookingReady: valued && validPoints(item.campus, points) };
  });
  state.loans = state.loans.map((loan) => {
    const pointId = loan.pointId ?? locationFromName(loan.point)?.id;
    const order = pointId && !loan.pointId ? { ...loan, pointId } : loan;
    return order.status === "approved" && loanTotal(order) === 0
      ? advance(order, order.borrower, "paid", order.history.approved) : order;
  });
  const ownAccount = (state: State, person: Person) => Object.hasOwn(state.accounts, person) ? state.accounts[person] : undefined;
  // Older synthetic submissions referenced a shared SVG before the demo flag existed.
  const latestVerification = (state: State, person: Person) => {
    const entry = Object.hasOwn(state.verifications, person) ? state.verifications[person][0] : undefined;
    return entry?.photo === "/ktm-demo.svg" ? { ...entry, demo: true } : entry;
  };
  function verificationStatus(state: State, person: Person): VerificationStatus {
    const account = ownAccount(state, person);
    if (demoVerificationEnabled() && account?.demoLoanAccess && account.role === "student" && ["raka","naya"].includes(person)) return "approved";
    const entry = latestVerification(state, person);
    if (entry?.demo && !demoVerificationEnabled()) return "revision";
    if (entry?.status === "pending" && entry.ocr?.outcome !== "match") return "revision";
    return entry?.status ?? "none";
  }
  function requireVerified(state: State) {
    const account = ownAccount(state, state.person);
    if (account?.role !== "student" || !account.confirmed || verificationStatus(state, state.person) !== "approved") {
      throw new Error("Verifikasi mahasiswa harus disetujui sebelum mengajukan peminjaman atau memasang barang.");
    }
  }
  function requireAdmin(state: State) {
    const account = ownAccount(state, state.person);
    if (!account?.confirmed || account.role !== "admin") throw new Error("Akses khusus admin demo.");
  }

  function updateProfile(name: string) {
    const state = read();
    const account = ownAccount(state, state.person);
    name = name.trim();
    if (!account?.confirmed) throw new Error("Masuk untuk mengubah profil.");
    if (name.length < 2 || name.length > 80) throw new Error("Nama lengkap harus berisi 2–80 karakter.");
    save({ ...state, accounts: { ...state.accounts, [state.person]: { ...account, name } } });
  }
  function maySubmitVerification() {
    const state = read();
    const account = ownAccount(state, state.person);
    if (!account?.confirmed || account.role !== "student") throw new Error("Masuk dengan akun mahasiswa dan konfirmasi email terlebih dahulu.");
    const status = verificationStatus(state, state.person);
    if (!canSubmitVerification(status)) throw new Error("Pengajuan baru belum tersedia untuk status ini.");
  }
  function submitVerification(nim: string, campus: Campus, photo: string, check: { ocr: OcrCheck; demo: boolean }) {
    maySubmitVerification();
    validateVerification(nim, campus, photo);
    const reasons = { missing: "NIM belum terbaca pada foto. Pastikan NIM terlihat jelas, lalu ambil atau unggah foto ulang.",
      mismatch: "NIM yang terbaca berbeda dari NIM yang diisi. Periksa input atau ganti foto, lalu ajukan ulang.",
      uncertain: "Hasil pembacaan meragukan. Ambil foto ulang dengan NIM yang lebih tajam." };
    const outcome = check.ocr.outcome;
    const entry: Verification = { id: crypto.randomUUID(), nim, campus, photo, ...check, status: outcome === "match" ? "pending" : outcome === "uncertain" ? "retake" : "autoRejected",
      reason: outcome === "match" ? undefined : reasons[outcome], submittedAt: new Date().toISOString() };
    save({ ...state, verifications: { ...state.verifications, [state.person]: [entry, ...(state.verifications[state.person] ?? [])] } });
  }
  function verificationDocument(id: Person) {
    const state = read();
    if (state.person !== id) requireAdmin(state);
    if (!ownAccount(state, state.person)?.confirmed) throw new Error("Masuk untuk melihat dokumen verifikasi.");
    return latestVerification(state, id);
  }
  function adminRecords() {
    const state = read();
    requireAdmin(state);
    const applications = Object.entries(state.verifications).map(([id,entries]) => ({id, entries, name: ownAccount(state,id)?.name ?? id}));
    const queue = applications.flatMap(({id,name,entries}) => {
      const entry = entries[0];
      return entry?.status === "pending" && entry.ocr?.outcome === "match" && entry.ocr.detected === entry.nim && (!entry.demo || demoVerificationEnabled()) ? [{id,name,entry}] : [];
    });
    const history = applications.flatMap(({id,name,entries}) => entries.filter(entry => entry.reviewedAt).map(entry => ({id,name,entry})));
    return { queue, history, receipts: state.receipts };
  }
  function reviewVerification(id: Person, status: "approved" | "rejected" | "revision", reason: string, submission: string) {
    const state = read();
    requireAdmin(state);
    const entry = latestVerification(state, id);
    if (!["approved", "rejected","revision"].includes(status) || state.person === id || entry?.status !== "pending" || entry.id !== submission ||
      entry.ocr?.outcome !== "match" || entry.ocr.detected !== entry.nim || (entry.demo && !demoVerificationEnabled())) throw new Error("Pengajuan ini tidak dapat diperiksa.");
    reason = reason.trim();
    if (status !== "approved" && !reason) throw new Error("Isi alasan penolakan atau perbaikan.");
    if (reason.length > 400) throw new Error("Alasan maksimal 400 karakter.");
    const review = { ...entry, status, reason, reviewer: state.person, reviewedAt: new Date().toISOString() };
    save({ ...state, verifications: { ...state.verifications, [id]: [review, ...state.verifications[id].slice(1)] } });
  }

  function listingValuation(id: string) {
    const state = read();
    const item = state.items.find((entry) => entry.id === id);
    if (!item || item.owner !== state.person) requireAdmin(state);
    return state.valuations[id];
  }
  function addItem(item: Omit<Item, "id" | "owner" | "deposit">, estimatedValue: number, editId?: string) {
    const state = read();
    requireVerified(state);
    const original = state.items.find((entry) => entry.id === editId);
    if (editId && (!original || original.owner !== state.person || original.archivedAt || original.moderation?.length)) throw new Error("Listing ini tidak dapat diubah oleh akun aktif.");
    const photos = listingPhotos(item);
    if (!photos.length) throw new Error("Tambahkan minimal satu foto sebelum publikasi.");
    const id = editId ?? crypto.randomUUID();
    const deposit = depositFor(estimatedValue);
    if (!validPoints(item.campus, item.points)) throw new Error("Pilih titik serah terima yang sesuai kampus.");
    const { name, category, campus, description, condition, contents, points, rate, maxDays } = item;
    const updated: Item = { id, owner: state.person, name, category, campus, description, condition, contents, points: [...new Set(points)], rate, maxDays, deposit, photos, active: true };
    const items = original ? state.items.map((entry) => entry.id === id ? updated : entry) : [updated, ...state.items];
    const size = (entries: Item[]) => entries.reduce((sum, entry) => sum + listingPhotos(entry).reduce((n, src) => n + src.length, 0), 0);
    if (size(items) > catalogPhotoCapacity && size(items) > size(state.items)) throw new Error("Kapasitas foto demo 3 MB telah tercapai. Gunakan foto yang lebih kecil.");
    save({ ...state, items, valuations: { ...state.valuations, [id]: estimatedValue } });
    return id;
  }

  function removeListing(id: string, action: "hide" | "archive", reason = "") {
    const state = read();
    const item = state.items.find((entry) => entry.id === id);
    if (!item || item.archivedAt) throw new Error("Listing tidak tersedia.");
    const admin = ownAccount(state, state.person)?.role === "admin";
    if (admin) {
      requireAdmin(state);
      if (!reason.trim() || reason.trim().length > 400) throw new Error("Isi alasan tindakan admin (maksimal 400 karakter).");
    } else if (!state.person || state.person !== item.owner) {
      throw new Error("Hanya pemilik atau admin berwenang yang dapat mengubah listing.");
    }
    if (action === "archive" && hasOpenLoans(id, state.loans)) throw new Error("Selesaikan transaksi aktif sebelum menghapus barang. Listing dapat dinonaktifkan dari pemesanan baru.");
    if (action === "hide" && item.active === false) throw new Error("Listing sudah dinonaktifkan.");
    const at = new Date().toISOString();
    const moderation = admin ? [...(item.moderation ?? []), { actor: state.person, at, reason: reason.trim(), action }] : item.moderation;
    if (!["hide", "archive"].includes(action)) throw new Error("Tindakan tidak valid.");
    const updated = { ...item, active: false, archivedAt: action === "archive" ? at : undefined, moderation };
    save({ ...state, items: state.items.map((entry) => entry.id === id ? updated : entry) });
  }
  function requestLoan(itemId: string, start: string, end: string, point: string) {
    const state = read();
    requireVerified(state);
    const item = state.items.find((entry) => entry.id === itemId && isPublished(entry));
    if (!item) throw new Error("Barang tidak ditemukan.");
    if (!item.bookingReady) throw new Error("Pemilik perlu melengkapi data listing sebelum menerima pemesanan.");
    const deposit = depositFor(state.valuations[item.id]);
    const error = validateRequest(item, state.loans, state.person, start, end, point);
    if (error) throw new Error(error);
    const costs = quote({ ...item, deposit }, start, end);
    if (!Number.isSafeInteger(costs.rental * costs.servicePercent) || !Number.isSafeInteger(costs.total)) {
      throw new Error("Tagihan melebihi batas nominal Rupiah.");
    }
    const id = crypto.randomUUID();
    const loan: Loan = {
      id, itemId, start, end, pointId: point, point: locationFor(item.campus, point)!.name, borrower: state.person, owner: item.owner, status: "requested",
      history: { requested: new Date().toISOString() }, ...costs,
    };
    save({ ...state, loans: [loan, ...state.loans] });
    return id;
  }
  function changeStatus(id: string, next: Status) {
    const state = read();
    const loan = state.loans.find((loan) => loan.id === id);
    if (!loan || ![loan.owner, loan.borrower].includes(state.person)) throw new Error("Transaksi tidak ditemukan.");
    if (next === "paid") throw new Error("Konfirmasi pembayaran melalui halaman QRIS simulasi.");
    if (next === "handover" && state.loans.some((other) => other.id !== id && other.itemId === loan.itemId && ["handover", "active", "returning"].includes(other.status))) {
      throw new Error("Selesaikan peminjaman sebelumnya sebelum menyerahkan barang.");
    }
    const changed = advance(loan, state.person, next);
    const updated = next === "approved" && loanTotal(loan) === 0 ? advance(changed, loan.borrower, "paid") : changed;
    save({ ...state, loans: state.loans.map((loan) => loan.id === id ? updated : loan) });
  }

  function createPromotion(itemId: string) {
    const state = read();
    requireVerified(state);
    const item = state.items.find((entry) => entry.id === itemId && entry.owner === state.person && isPublished(entry));
    if (!item) throw new Error("Hanya pemilik yang dapat mempromosikan barang aktif.");
    const pending = state.promotions.find((order) => order.itemId === itemId && order.buyer === state.person && order.status === "pending");
    if (pending) return pending;
    const id = crypto.randomUUID();
    const order: Promotion = { id, itemId, buyer: state.person, ...demoConfig.promotion, status: "pending", createdAt: new Date().toISOString() };
    const purchase = order.price === 0 ? activatePromotion(order, state.promotions, new Date()) : order;
    save({ ...state, promotions: [purchase, ...state.promotions] });
    return purchase;
  }

  function completeSimulatedPayment(kind: Receipt["kind"], id: string, payer: Person, time: Date) {
    const state = read();
    if (demoConfig.paymentMode !== "simulation" || !payer || payer !== state.person) throw new Error("Akun pembayar atau mode simulasi tidak valid.");
    const previous = state.receipts.find((receipt) => receipt.id === id && receipt.kind === kind && receipt.payer === payer);
    if (previous) return previous;
    const paidAt = time.toISOString();
    const receipt: Receipt = { id, kind, payer, mode: "simulation", status: "succeeded", paidAt, rental: 0, deposit: 0, service: 0, commission: 0, promotionRevenue: 0 };
    let { loans, promotions } = state;
    if (kind === "loan") {
      const loan = loans.find((loan) => loan.id === id && loan.borrower === payer);
      if (loan?.status !== "approved" || loanTotal(loan) <= 0) throw new Error("Tagihan ini tidak tersedia untuk pembayaran.");
      Object.assign(receipt, {
        rental: loan.rental, owner: loan.owner, ownerProceeds: loan.rental,
        deposit: loan.deposit, service: loan.service, servicePercent: loan.servicePercent, total: loanTotal(loan),
      });
      loans = loans.map((entry) => entry.id === id ? advance(loan, payer, "paid", paidAt) : entry);
    } else {
      const order = promotions.find((order) => order.id === id && order.buyer === payer);
      const item = order && state.items.find((entry) => entry.id === order.itemId && entry.owner === payer && isPublished(entry));
      if (!order || !item || order.status !== "pending" || order.price <= 0) throw new Error("Paket promosi ini tidak tersedia untuk pembayaran.");
      receipt.promotionRevenue = order.price;
      const active = activatePromotion(order, promotions, time);
      promotions = promotions.map((entry) => entry.id === id ? active : entry);
    }
    save({ ...state, loans, promotions, receipts: [receipt, ...state.receipts] });
    return receipt;
  }

  function refundServiceFee(id: string, reason: string) {
    requireAdmin(state);
    const receipt = state.receipts.find(entry => entry.kind === "loan" && entry.id === id);
    const loan = state.loans.find(entry => entry.id === id);
    if (demoConfig.paymentMode !== "simulation" || receipt?.mode !== "simulation" || receipt.status !== "succeeded" ||
        receipt.service <= 0 || loan?.status !== "cancelled" || loan.history.handover) {
      throw new Error("Refund biaya layanan tersedia untuk pembayaran yang dibatalkan sebelum serah terima.");
    }
    if (receipt.serviceRefund) return;
    if (!reason.trim() || reason.trim().length > 400) throw new Error("Isi alasan refund (maksimal 400 karakter).");
    const serviceRefund = { amount: receipt.service, at: new Date().toISOString(), actor, reason: reason.trim() };
    save({ ...state, receipts: state.receipts.map(entry => entry === receipt ? { ...entry, serviceRefund } : entry) });
  }

  function view() {
    const account = ownAccount(state, actor);
    const admin = account?.role === "admin";
    const loans = state.loans.filter((loan) => admin || (actor && [loan.owner, loan.borrower].includes(actor)));
    const items = state.items.filter((item) => admin || item.owner === actor || isPublished(item) || loans.some((loan) => loan.itemId === item.id));
    const visibleItemIds = new Set(items.map(item => item.id));
    const receipts = state.receipts.filter((receipt) => receipt.payer === actor);
    const visiblePeople = new Set([...items.map(i => i.owner), ...loans.flatMap(l => [l.owner, l.borrower]), actor]);
    for (const item of items) {
      if (item.owner === actor) item.moderation?.forEach(entry => visiblePeople.add(entry.actor));
    }
    return {
      person: actor, items: items.map(item => admin || actor === item.owner ? item : { ...item, moderation: undefined }), loans,
      busyItemIds: state.loans.filter(l => visibleItemIds.has(l.itemId) && ["handover","active","returning"].includes(l.status)).map(l => l.itemId),
      profile: account && { name: account.name, role: account.role, email: account.email, confirmed: account.confirmed },
      names: Object.fromEntries(Object.entries(state.accounts).filter(([id]) => admin || visiblePeople.has(id)).map(([id, a]) => [id, a.name])),
      verificationStatus: verificationStatus(state, actor),
      demoVerification: demoVerificationEnabled(),
      onlineDemo: onlineDemo(),
      promotions: state.promotions.filter(order => admin || order.buyer === actor),
      promotionWindows: state.promotions.filter(order => order.status === "paid" && Date.parse(order.endsAt ?? "") > Date.now() && isPublishedForOrder(order))
        .map(({ itemId, startsAt, endsAt }) => ({ itemId, startsAt: startsAt!, endsAt: endsAt! })),
      valuations: Object.fromEntries(Object.entries(state.valuations).filter(([id]) => admin || items.some(i => i.id === id && i.owner === actor))),
      document: account && latestVerification(state, actor), receipts,
      admin: admin ? adminRecords() : undefined,
    };
  }
  function isPublishedForOrder(order: Promotion) {
    return state.items.some(item => item.id === order.itemId && item.owner === order.buyer && isPublished(item));
  }
  return { view, addItem, listingValuation, removeListing, requestLoan, changeStatus, createPromotion, updateProfile, maySubmitVerification, submitVerification, reviewVerification, adminRecords, verificationDocument, completeSimulatedPayment, refundServiceFee };
}
export type View = ReturnType<ReturnType<typeof domain>["view"]>;
