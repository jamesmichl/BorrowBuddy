"use client";

import { KtmCamera } from "./ktm-camera";
import { BrandLogo } from "./brand-logo";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { canSubmitVerification, nimPattern, sampleVariants, verificationLabels, verificationPhotoLimit, type SampleVariant, type Verification } from "@/lib/accounts";
import { adminRecords, confirmDemoRegistration, confirmEmail, login, logout, reviewVerification, signup, snapshot, submitVerification, updateProfile, verificationDocument } from "@/lib/demo";
import { campuses, dateLabel, rupiah } from "@/lib/loans";
import { cashReport, promotionStatus } from "@/lib/payments";

type Demo = ReturnType<typeof snapshot>;
const message = (error: unknown) => error instanceof Error ? error.message : "Perubahan gagal disimpan.";
const text = (form: FormData, name: string) => String(form.get(name) ?? "");

export function AuthForm({ register, online }: { register: boolean; online: boolean }) {
  const pending = useRef(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      if (register) {
        const result = await signup(text(form, "name"), text(form, "email"), text(form, "password"), text(form, "confirmation"));
        window.location.replace(result.mode === "demo" ? "/konfirmasi-email#demo." + result.ticket : "/konfirmasi-email#terkirim");
      } else {
        await login(text(form, "email"), text(form, "password"));
        // The login page resolves its return destination using the new session cookie.
        window.location.reload();
      }
    } catch (error) { pending.current = false; setBusy(false); setError(message(error)); }
  }
  return <form className="panel form-panel narrow auth-panel" onSubmit={submit}>
    <div className="brand-strip"><BrandLogo /></div>
    <h1>{register ? "Daftar akun" : "Masuk ke BorrowBuddy"}</h1>
    {register && <p>{online ? "Gunakan nama samaran dan email fiktif dengan akhiran @student.borrowbuddy.test." : "Gunakan email kampus BINUS. Setelah daftar, selesaikan konfirmasi email sebelum masuk."}</p>}
    {register && <label>Nama lengkap<input name="name" autoComplete="name" minLength={2} maxLength={80} required /></label>}
    <label>{register ? online ? "Email fiktif" : "Email kampus" : "Email"}<input name="email" type="email" autoComplete="email" maxLength={254} placeholder={online ? "nama@student.borrowbuddy.test" : "nama@binus.ac.id"} required /></label>
    <label>Password<input name="password" type="password" autoComplete={register ? "new-password" : "current-password"} minLength={register ? 8 : undefined} maxLength={128} required /></label>
    {register && <label>Konfirmasi password<input name="confirmation" type="password" autoComplete="new-password" required /></label>}
    {error && <p className="error" role="alert">{error}</p>}
    <div className="form-actions"><button className="primary" disabled={busy}>{busy ? "Memproses…" : register ? "Daftar" : "Masuk"}</button>
      <Link className="secondary" href={register ? "/masuk" : "/daftar"}>{register ? "Sudah punya akun" : "Buat akun"}</Link></div>
  </form>;
}

export function ConfirmEmail({ online }: { online: boolean }) {
  const [done, setDone] = useState<"demo" | "email" | undefined>();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const token = typeof window === "undefined" ? "" : window.location.hash.slice(1);
  const demo = token.startsWith("demo.") && (online || process.env.NODE_ENV !== "production");
  async function confirm() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      if (demo) await confirmDemoRegistration(token.slice(5));
      else await confirmEmail(token);
      window.history.replaceState(null, "", "/konfirmasi-email");
      setDone(demo ? "demo" : "email");
      setError("");
    } catch (error) { setError(message(error)); } finally { pending.current = false; setBusy(false); }
  }
  return <section className="panel form-panel narrow"><div className="brand-strip"><BrandLogo /></div><h1>Konfirmasi email</h1>
    {done ? <><p role="status">{done === "demo" ? "Konfirmasi demo selesai." : "Email terkonfirmasi."} Silakan masuk untuk membuka katalog.</p><Link href="/masuk" className="primary">Masuk</Link></> :
      demo ? <><p>Mode demo. Tidak ada email yang dikirim. Konfirmasikan pendaftaran dari browser ini dalam 15 menit.</p>
        <button className="primary" disabled={busy} onClick={confirm}>{busy ? "Memproses…" : "Konfirmasi pendaftaran demo"}</button></> :
      /^[a-f0-9]{64}$/.test(token) ? <button className="primary" disabled={busy} onClick={confirm}>{busy ? "Memproses…" : "Konfirmasikan email saya"}</button> :
      <p>{token === "terkirim" ? "Periksa kotak masuk email kampus, lalu buka tautan konfirmasi yang kami kirimkan." : "Buka tautan konfirmasi yang sesuai dengan pendaftaran Anda."}</p>}
    {error && <p className="error" role="alert">{error}</p>}
  </section>;
}

export function Logout() {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function leave() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try { await logout(); window.location.replace("/masuk"); }
    catch (error) { pending.current = false; setBusy(false); setError(message(error)); }
  }
  return <section className="profile-logout"><button className="secondary" disabled={busy} onClick={leave}>{busy ? "Sedang keluar…" : "Keluar"}</button>
    {error && <p className="error" role="alert">{error}</p>}</section>;
}

export function Profile({ demo }: { demo: Demo }) {
  const [feedback, setFeedback] = useState("");
  const profile = demo.profile!;
  return <section className="panel form-panel narrow"><h1>Profil saya</h1><p>{profile.role === "admin" ? "Administrator" : "Mahasiswa"}</p>
    <dl className="facts"><div><dt>Email kampus</dt><dd>{profile.email}</dd></div><div><dt>Status email</dt><dd>{profile.confirmed ? "Terkonfirmasi" : "Belum terkonfirmasi"}</dd></div>
      {profile.role === "student" && <div><dt>Verifikasi mahasiswa</dt><dd>{verificationLabels[demo.verificationStatus]}</dd></div>}</dl>
    <form className="profile-edit" onSubmit={async (event) => {
      event.preventDefault();
      try { await updateProfile(text(new FormData(event.currentTarget), "name")); setFeedback("Nama profil disimpan."); } catch (error) { setFeedback(message(error)); }
    }}><label>Nama lengkap<input name="name" defaultValue={profile.name} required minLength={2} maxLength={80} /></label><button className="secondary">Simpan profil</button></form>
    {feedback && <p role="status">{feedback}</p>}
    <div><Link className="primary" href={profile.role === "admin" ? "/admin" : "/verifikasi"}>{profile.role === "admin" ? "Dashboard Admin" : "Verifikasi Mahasiswa"}</Link></div>
  </section>;
}

function KtmPhoto({ photo }: { photo: string }) {
  return <Image className="ktm-photo" src={photo} alt="Foto dokumen verifikasi" width={600} height={340} unoptimized />;
}

export function VerifyStudent({ demo }: { demo: Demo }) {
  const previous = verificationDocument(demo.person);
  const [nim, setNim] = useState(previous?.nim ?? "");
  const [photo, setPhoto] = useState("");
  const [variant, setVariant] = useState<SampleVariant>("match");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const lock = useRef(false);
  const picker = useRef<HTMLInputElement>(null);
  const sampleRequest = useRef(0);
  async function choose(load: () => Promise<Blob>, example = false) {
    const version = ++sampleRequest.current;
    setLoading(true); setError("");
    try {
      const file = await load();
      if (!file.size || file.size > verificationPhotoLimit || !["image/jpeg","image/png","image/webp"].includes(file.type)) throw new Error("Pilih JPG, PNG, atau WebP maksimal 1,5 MB.");
      const src = await new Promise<string>((resolve,reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Foto gagal dibaca."));
        reader.readAsDataURL(file);
      });
      const image = new window.Image();
      image.src = src;
      await image.decode();
      if (version === sampleRequest.current) { setPhoto(src); if (example) setNim("1234567890"); }
    } catch { if (version === sampleRequest.current) { setPhoto(""); setError("Foto gagal dimuat. Pilih gambar JPG, PNG, atau WebP hingga 1,5 MB."); } }
    finally { if (version === sampleRequest.current) setLoading(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || loading) return;
    if (!photo) { setError("Ambil foto atau pilih gambar terlebih dahulu."); return; }
    const campus = text(new FormData(event.currentTarget),"campus");
    lock.current = true; setBusy(true); setError("");
    try { await submitVerification(nim,campus,photo); }
    catch (error) { setError(message(error)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="panel form-panel narrow"><Link className="back" href="/profil">Kembali ke profil</Link><h1>Verifikasi Mahasiswa</h1>
    <p>OCR memeriksa kecocokan NIM. Admin memeriksa identitas dan dokumen sebelum memberikan persetujuan.</p>
    <p role="status"><strong>Status:</strong> {verificationLabels[demo.verificationStatus]}</p>
    {previous && <div className="verification-record"><p>{previous.demo ? "Pengajuan demo" : "Pengajuan"} · {dateLabel(previous.submittedAt)}</p>
      {previous.reviewedAt && <p>Pemeriksaan {dateLabel(previous.reviewedAt)}</p>}
      {previous.reason && <p className="error">{previous.reason}</p>}
      {previous.status === "pending" && !previous.ocr && <p>Pengajuan lama perlu dikirim ulang agar NIM dapat diperiksa.</p>}
      <details><summary>Lihat foto yang diajukan</summary><KtmPhoto photo={previous.photo} /></details></div>}
    {canSubmitVerification(demo.verificationStatus) && <form onSubmit={submit}><fieldset className="form-panel embedded-form verification-fields" disabled={busy || loading}>
      <label>NIM<input readOnly={demo.onlineDemo} name="nim" inputMode="numeric" pattern={nimPattern} maxLength={15} value={nim} onChange={e=>setNim(e.target.value)} required /></label>
      <label>Kampus BINUS<select name="campus" defaultValue={previous?.campus ?? ""} required><option value="">Pilih kampus</option>{campuses.map(campus => <option key={campus}>{campus}</option>)}</select></label>
      {demo.onlineDemo ? <p>Gunakan kartu sintetis bawaan untuk pengujian. Pilih skenario lalu tekan Gunakan Data Contoh.</p> : <><p>Pastikan seluruh KTM terlihat, tulisan NIM tajam, pencahayaan cukup, dan kartu tidak tertutup pantulan.</p>
      <div className="form-actions"><KtmCamera onPhoto={src=>{setPhoto(src);setError("");}} onError={setError} />
        <button className="secondary" type="button" onClick={()=>picker.current?.click()}>Pilih dari Galeri</button>
        <input hidden type="file" ref={picker} accept="image/jpeg,image/png,image/webp" onChange={e=>{
          const file = e.target.files?.[0]; e.target.value = ""; if (file) void choose(async()=>file);
        }}/></div>
      <small>JPG, PNG, atau WebP hingga 1,5 MB. Foto hanya dapat diakses oleh pemilik akun dan admin.</small></>}
      {demo.demoVerification && <div className="verification-record"><label>Skenario contoh<select value={variant} onChange={e=>setVariant(e.target.value as SampleVariant)}>
        {Object.entries(sampleVariants).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
        <button type="button" className="secondary" onClick={()=>void choose(async()=>{
          const response = await fetch("/api/verification/samples/" + variant,{cache:"no-store"});
          if (!response.ok) throw new Error();
          return response.blob();
        },true)}>Gunakan Data Contoh</button></div>}
      {photo && <div><KtmPhoto photo={photo}/><button className="secondary" type="button" onClick={()=>setPhoto("")}>Hapus foto</button></div>}
      <button className="primary" disabled={busy || loading}>{busy ? "Memeriksa NIM dengan OCR…" : previous ? "Ajukan ulang" : "Kirim verifikasi"}</button>
    </fieldset>{(loading || busy) && <p role="status">{busy ? "Pemeriksaan OCR sedang berlangsung…" : "Memuat foto…"}</p>}
      {error && <p role="alert" className="error">{error}</p>}</form>}
  </section>;
}

function Review({ id, entry }: { id: string; entry: Verification }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  async function decide(status: "approved" | "rejected" | "revision") {
    try { await reviewVerification(id, status, status === "approved" ? "" : reason, entry.id!); setError(""); } catch (error) { setError(message(error)); }
  }
  return <div className="verification-record"><p>{entry.demo ? "Pengajuan demo · " : ""}NIM yang diisi {entry.nim} · {entry.campus}</p><p>NIM terbaca {entry.ocr?.detected} · Cocok · Confidence OCR {entry.ocr?.confidence}</p><p>Periksa nama, kampus, kondisi dokumen, dan tanda manipulasi sebelum memutuskan.</p><p>Pengajuan {dateLabel(entry.submittedAt)}</p>
    <KtmPhoto photo={entry.photo} />
    <label>Alasan penolakan atau perbaikan<textarea maxLength={400} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
    <div className="form-actions"><button className="primary" onClick={() => decide("approved")}>Setujui verifikasi</button><button className="secondary" onClick={() => decide("rejected")}>Tolak verifikasi</button><button className="secondary" onClick={() => decide("revision")}>Minta perbaikan</button></div>
    {error && <p className="error" role="alert">{error}</p>}
  </div>;
}

export function Admin({ demo, now }: { demo: Demo; now: number }) {
  const { queue, history, receipts } = adminRecords();
  const cash = cashReport(receipts);
  return <><div className="page-heading"><div className="admin-brand"><BrandLogo /></div><h1>Dashboard Admin</h1><p>Admin demo · Antrean verifikasi dan riwayat promosi lokal</p></div>
    <div className="detail-grid"><section className="panel form-panel"><h2>Antrean verifikasi</h2>
      {!queue.length && <p>Tidak ada pengajuan menunggu.</p>}
      {queue.map(({ id, name, entry }) => <details key={entry.id}><summary>{name} · {entry.campus}{entry.demo ? " · Demo" : ""}</summary><Review id={id} entry={entry} /></details>)}
      <h2>Riwayat pemeriksaan</h2>
      {!history.length && <p>Belum ada keputusan.</p>}
      {history.map(({ name, id, entry }) => <details key={id + entry.submittedAt}><summary>{name} · {verificationLabels[entry.status]}{entry.demo ? " · Demo" : ""}</summary><div className="verification-record">
        <p>NIM {entry.nim} · {entry.campus}</p><p>{dateLabel(entry.reviewedAt!)} · {demo.names[entry.reviewer!] ?? "Admin Demo"}</p>{entry.reason && <p>{entry.reason}</p>}<KtmPhoto photo={entry.photo} />
      </div></details>)}
    </section><section className="panel form-panel"><h2>Riwayat pembelian promosi</h2>
      {!demo.promotions.length && <p>Belum ada pembelian promosi.</p>}
      {demo.promotions.map((order) => <div key={order.id} className="verification-record"><strong>{demo.items.find((item) => item.id === order.itemId)?.name ?? "Barang tidak tersedia"}</strong>
        <p>{demo.names[order.buyer]} · {promotionStatus(order, now)} · {rupiah(order.price)}</p>
        {order.startsAt && order.endsAt && <small>{dateLabel(order.startsAt)} – {dateLabel(order.endsAt)}</small>}</div>)}
      <h2>Kas aplikasi simulasi</h2><dl className="facts">
        <div><dt>Saldo kas simulasi</dt><dd>{rupiah(cash.balance)}</dd></div>
        <div><dt>Biaya layanan diterima</dt><dd>{rupiah(cash.totals.service)}</dd></div>
        <div><dt>Refund biaya layanan</dt><dd>{rupiah(cash.totals.refund)}</dd></div>
        <div><dt>Pendapatan promosi</dt><dd>{rupiah(cash.totals.promotion)}</dd></div>
        {!!cash.totals.commission && <div><dt>Komisi sewa lama</dt><dd>{rupiah(cash.totals.commission)}</dd></div>}
      </dl>
      <h3>Riwayat kas simulasi</h3>
      {!cash.entries.length && <p>Belum ada mutasi kas.</p>}
      {cash.entries.map(entry => <div className="verification-record" key={entry.category + ":" + entry.id}>
        <strong>{entry.label} · {rupiah(entry.amount)}</strong>
        <p>{dateLabel(entry.at)} · {entry.category === "promotion" ? entry.id : <Link href={`/transaksi/${entry.id}`}>Transaksi {entry.id}</Link>}</p>
        {entry.reason && <p>Alasan refund: {entry.reason}</p>}
      </div>)}
    </section></div>
  </>;
}
