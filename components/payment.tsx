"use client";
import { isPublished } from "@/lib/loans";


import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, QrCode } from "lucide-react";
import { toDataURL } from "qrcode";
import { demoConfig } from "@/lib/config";
import { confirmSimulatedPayment, createPromotion, paymentReceipt } from "@/lib/demo";
import { dateLabel, rupiah, type Item, type Loan } from "@/lib/loans";
import { loanTotal, qrPayload, serviceLabel, type LoanCosts, type Promotion } from "@/lib/payments";
import { useRouter } from "next/navigation";

export function PromotionSummary({ item, orders, now }: { item: Item; orders: Promotion[]; now: number }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const opening = useRef(false);
  const until = promotionEnd(item.id, orders, now);
  const start = until ?? now;
  const pending = orders.find((order) => order.itemId === item.id && order.status === "pending");
  const pack = pending ?? demoConfig.promotion;
  return <section className="panel form-panel narrow">
    <Link className="back" href={`/barang/${item.id}`}>Kembali ke barang</Link>
    <h1>Promosikan Barang</h1><p>{item.name}</p>
    <dl className="costs"><div><dt>Masa tayang</dt><dd>{pack.days} hari</dd></div><div><dt>Total paket demo</dt><dd>{rupiah(pack.price)}</dd></div></dl>
    {until && <p>Paket baru dimulai setelah masa tayang saat ini berakhir, {dateLabel(new Date(start).toISOString())}.</p>}
    <p className="notice">Barang aktif tampil di bagian promosi selama cocok dengan pencarian dan filter pengunjung.</p>
    <div className="form-actions"><button className="primary" onClick={async () => {
      if (opening.current) return;
      opening.current = true;
      try {
        const order = await createPromotion(item.id);
        router.push(order.price === 0 ? `/barang/${item.id}` : `/pembayaran/promosi/${order.id}`);
      } catch (error) { opening.current = false; setError((error as Error).message); }
    }}>{pack.price === 0 ? "Aktifkan paket gratis" : "Lanjut ke QRIS simulasi"}</button></div>
    {error && <p className="error" role="alert">{error}</p>}
  </section>;
}

export function promotionEnd(id: string, orders: Promotion[], now: number) {
  return orders.reduce<number | undefined>((latest, order) => {
    const end = Date.parse(order.endsAt ?? "");
    return order.itemId === id && order.status === "paid" && end > now ? Math.max(latest ?? 0, end) : latest;
  }, undefined);
}

type Bill = { kind: "loan"; loan: Loan } | { kind: "promotion"; order: Promotion; item: Item };

export function Costs(costs: LoanCosts) {
  return <dl className="costs">
    <div><dt>Subtotal sewa</dt><dd>{rupiah(costs.rental)}</dd></div>
    <div><dt>{serviceLabel(costs.servicePercent)}</dt><dd>{rupiah(costs.service)}</dd></div>
    <div><dt>Deposit (jaminan sementara)</dt><dd>{rupiah(costs.deposit)}</dd></div>
    <div><dt>Total pembayaran simulasi</dt><dd>{rupiah(loanTotal(costs))}</dd></div>
  </dl>;
}

export function Checkout({ bill }: { bill: Bill }) {
  const id = bill.kind === "loan" ? bill.loan.id : bill.order.id;
  const receipt = paymentReceipt(bill.kind, id);
  const href = bill.kind === "loan" ? `/transaksi/${id}` : `/barang/${bill.item.id}`;
  const total = bill.kind === "loan" ? loanTotal(bill.loan) : bill.order.price;
  const available = demoConfig.paymentMode === "simulation" && (bill.kind === "loan"
    ? bill.loan.status === "approved" && total > 0 : bill.order.status === "pending" && total > 0 && isPublished(bill.item));
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    if (!available || receipt) return;
    let current = true;
    toDataURL(qrPayload(id), { width: 224, margin: 3, errorCorrectionLevel: "M" }).then((data) => {
      if (current) setQr(data);
    }).catch(() => { if (current) setError("QR dummy gagal dibuat. Muat ulang halaman untuk mencoba lagi."); });
    return () => { current = false; };
  }, [available, id, receipt]);
  async function confirm() {
    if (lock.current || !available || receipt) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await new Promise((resolve) => setTimeout(resolve, 350));
      await confirmSimulatedPayment(bill.kind, id);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return <section className="panel form-panel narrow">
    <Link className="back" href={href}>Kembali ke {bill.kind === "loan" ? "transaksi" : "barang"}</Link>
    <h1>QRIS — Simulasi</h1><p className="notice"><QrCode size={20} />Demo: tidak ada pembayaran sungguhan</p>
    <div className="payment-id"><small>Nomor transaksi</small><strong>{id}</strong></div>
    {bill.kind === "loan" ? <Costs {...(receipt ?? bill.loan)} /> : <dl className="costs">
      <div><dt>Paket promosi · {bill.order.days} hari</dt><dd>{rupiah(bill.order.price)}</dd></div>
      <div><dt>Total pembayaran</dt><dd>{rupiah(total)}</dd></div>
    </dl>}
    {receipt ? <div role="status" className="payment-result"><Check size={26} /><h2>Pembayaran simulasi berhasil</h2><p>{dateLabel(receipt.paidAt)}</p>
      {bill.kind === "promotion" && bill.order.startsAt && bill.order.endsAt && <p>Masa tayang {dateLabel(bill.order.startsAt)} – {dateLabel(bill.order.endsAt)}</p>}
      {receipt.serviceRefund && <p>Refund biaya layanan simulasi {rupiah(receipt.serviceRefund.amount)} · {dateLabel(receipt.serviceRefund.at)}</p>}
      <Link className="primary" href={href}>{bill.kind === "loan" ? (bill.loan.status === "paid" ? "Lanjut ke serah terima" : "Lihat transaksi") : "Lihat barang"}</Link></div> :
      available ? <div className="payment-result">
        {qr && <Image width={224} height={224} src={qr} alt={`Kode QR dummy transaksi ${id}`} unoptimized />}
        <button className="primary" disabled={busy || !qr} aria-busy={busy} onClick={confirm}>{busy ? "Memproses…" : "Sudah Bayar"}</button>
      </div> : <p className="notice">Pembayaran QRIS simulasi tidak diperlukan atau tagihan sudah ditutup.</p>}
    {error && <p className="error" role="alert">{error}</p>}
  </section>;
}
