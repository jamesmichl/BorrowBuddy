"use client";

import { BrandLogo } from "./brand-logo";
import { CatalogHero } from "./catalog-hero";
import Link from "next/link";
import { Photo, PhotoEditor, ListingActions, ManagedListings } from "./listings";
import { campusLocations, locationFor, validPoints } from "@/lib/locations";
import { depositFor, listingPhotos, isPublished } from "@/lib/loans";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { ArrowLeft, ArrowRightLeft, CalendarDays, Check, ChevronDown, ChevronRight, Clock3, Grid2X2, MapPin, Package, Plus, Search, ShieldCheck, SlidersHorizontal, Star } from "lucide-react";
import { listingValuation, addItem, changeStatus, refundServiceFee, requestLoan, serverSnapshot, snapshot, subscribe } from "@/lib/demo";
import { actionsFor, campuses, categories, dateLabel, depositState, filterItems, people, quote, rupiah, statuses, statusLabel, stepIndex, steps, validateRequest, type Item, type Loan } from "@/lib/loans";
import { accountInitials } from "@/lib/accounts";
import { loanTotal } from "@/lib/payments";
import { demoConfig } from "@/lib/config";
import { loginPath } from "@/lib/login-path";
import { Admin, AuthForm, ConfirmEmail, Logout, Profile, VerifyStudent } from "./accounts";
import { Checkout, Costs, promotionEnd, PromotionSummary } from "./payment";

type Demo = ReturnType<typeof snapshot>;
const itemPath = (item: Item) => `/barang/${item.id}`;
const loanPath = (loan: Loan) => `/transaksi/${loan.id}`;
const errorText = (error: unknown) => error instanceof Error ? error.message : "Perubahan gagal disimpan.";

function Navigation({ demo, route }: { demo: Demo; route: string[] }) {
  const signIn = route[0] === "barang" && route.length === 2 ? loginPath("/barang/" + route[1]) : "/masuk";
  const links = <>
    <Link href="/" className={!route.length || route[0] === "barang" ? "selected" : ""}><Grid2X2 size={17} /> Katalog</Link>
    <Link href="/transaksi" className={route[0] === "transaksi" ? "selected" : ""}><ArrowRightLeft size={17} /> Transaksi</Link>
    {demo.profile?.role === "admin" ? <Link href="/admin" className={route[0] === "admin" ? "selected" : ""}><ShieldCheck size={17} /> Admin</Link> : <Link href="/pasang" className="nav-add"><Plus size={17} /> Pasang Barang</Link>}
  </>;
  return <>
    <header className="top"><div className="shell top-inner">
      <Link href="/" className="brand"><BrandLogo /></Link>
      <nav className="desktop-nav" aria-label="Navigasi utama">{links}</nav>
      <div className="account-tools">
        {demo.profile ? <Link className="account" href="/profil" aria-label={`Profil saya, ${demo.profile.name}`}>
          <span className="avatar" aria-hidden="true">{accountInitials(demo.profile.name)}</span><strong>{demo.profile.name}</strong>
        </Link> : <><Link className="account-link" href={signIn}>Masuk</Link><Link className="account-link" href="/daftar">Daftar</Link></>}
      </div>
    </div></header>
    <nav className="mobile-nav" aria-label="Navigasi utama">{links}</nav>
  </>;
}

function Catalog({ demo, now }: { demo: Demo; now: number }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [campus, setCampus] = useState("");
  const [price, setPrice] = useState("");
  const list = filterItems(demo.items, query, category, campus, price);
  const promoted = new Set(demo.promotionWindows.filter(order => Date.parse(order.startsAt) <= now && now < Date.parse(order.endsAt)).map(order => order.itemId));
  const featured = list.filter((item) => promoted.has(item.id)).sort((a, b) => a.id.localeCompare(b.id));
  const standard = list.filter((item) => !promoted.has(item.id));
  const active = demo.loans.find((loan) => loan.borrower === demo.person && loan.status === "active");
  const currentItem = active && demo.items.find((item) => item.id === active.itemId);
  return <>
    <CatalogHero />
    {demo.profile?.role === "student" && demo.verificationStatus !== "approved" &&
      <aside className="verification-prompt">
        <p>{demo.verificationStatus === "pending" ? "Verifikasi mahasiswa sedang diperiksa." :
          demo.verificationStatus === "rejected" ? "Perbaiki pengajuan verifikasi untuk mulai meminjam dan memasang barang." :
          "Verifikasi akun mahasiswa untuk mulai meminjam dan memasang barang."}</p>
        <Link className="secondary" href="/verifikasi">{demo.verificationStatus === "pending" ? "Lihat status verifikasi" :
          demo.verificationStatus === "rejected" ? "Perbaiki verifikasi" : "Verifikasi Mahasiswa"}</Link>
      </aside>}
    {active && currentItem && <Link className="active-banner" href={loanPath(active)}>
      <span className="icon-box"><Clock3 size={21} /></span>
      <span><small>Peminjaman aktif</small><strong>{currentItem.name}</strong></span>
      <span className="active-date">Kembali {dateLabel(active.end)}</span>
      <span className="active-link">Lihat transaksi <ChevronRight size={17} /></span>
    </Link>}
    <section id="katalog" className="catalog">
      <div className="section-heading"><div><h2>Katalog barang</h2><p>Temukan perlengkapan yang kamu butuhkan di kampus.</p></div><span>{list.length} barang</span></div>
      <div className="filters">
        <label className="search"><Search size={19} /><input aria-label="Cari barang" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari kabel HDMI, charger, kalkulator…" /></label>
        <Filter label="Kategori" any="Kategori" options={categories} value={category} set={setCategory} />
        <Filter label="Kampus" any="Kampus" options={campuses} value={campus} set={setCampus} />
        <label className="filter"><SlidersHorizontal size={16} /><select aria-label="Harga" value={price} onChange={(event) => setPrice(event.target.value)}><option value="">Semua harga</option><option value="free">Gratis</option><option value="paid">Berbayar</option></select><ChevronDown size={14} /></label>
      </div>
      {!list.length && <div className="panel empty"><Search size={26} /><h3>Barang belum ditemukan</h3><button className="secondary" onClick={() => { setQuery(""); setCategory(""); setCampus(""); setPrice(""); }}>Hapus filter</button></div>}
      {featured.length > 0 && <section className="promotion-section" aria-label="Barang dipromosikan"><h3>Barang dipromosikan</h3>
        <ItemCards list={featured} demo={demo} promoted />
      </section>}
      <ItemCards list={standard} demo={demo} />
    </section>
  </>;
}

function ItemCards({ list, demo, promoted = false }: { list: Item[]; demo: Demo; promoted?: boolean }) {
  if (!list.length) return null;
  return <div className="item-grid">{list.map((item) => {
        const busy = demo.busyItemIds.includes(item.id);
        return <article key={item.id} className={promoted ? "item-card item-card-promoted" : "item-card"}>
          <Link href={itemPath(item)} className="item-card-link">
          <div className="card-media"><Photo item={item} /><span className={`pill price ${item.rate ? "paid" : "free"}`}>{item.rate ? `${rupiah(item.rate)} / hari` : "Gratis"}</span></div>
          <div className="item-info">{promoted && <span className="promotion-tag">Dipromosikan</span>}<small className="category">{item.category}</small><h3>{item.name}</h3>
            <p><MapPin size={15} /> {item.campus}</p>
            <div className="card-bottom"><span className={`availability ${busy ? "busy" : ""}`}><i />{busy ? "Sedang dipinjam" : "Tersedia"}</span><span className="card-arrow"><ChevronRight size={17} /></span></div>
          </div>
          </Link>
          {demo.profile?.role === "admin" && <ListingActions item={item} demo={demo} card />}
        </article>;
      })}</div>;
}

function Filter({ label, any, options, value, set }: { label: string; any: string; options: readonly string[]; value: string; set: (value: string) => void }) {
  return <label className="filter"><select aria-label={label} value={value} onChange={(event) => set(event.target.value)}><option value="">{any}</option>{options.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown size={14} /></label>;
}

function Back({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link className="back" href={href}><ArrowLeft size={17} />{children}</Link>;
}

function ItemDetail({ item, demo, now }: { item: Item; demo: Demo; now: number }) {
  const admin = demo.profile?.role === "admin";
  const own = !admin && !!demo.profile && demo.person === item.owner;
  const owner = demo.names[item.owner] ?? "Mahasiswa demo";
  const rating = Object.hasOwn(people, item.owner) ? people[item.owner as keyof typeof people].rating : null;
  const until = promotionEnd(item.id, demo.promotions, now);
  return <><Back href="/">Kembali ke katalog</Back><div className="detail-grid">
    <div className="detail-photo">{listingPhotos(item).map((src, index) => <Photo key={index} item={item} src={src} />)}</div>
    <section className="panel detail-info">
      <span className={`pill ${demo.busyItemIds.includes(item.id) ? "warm" : "free"}`}>{item.archivedAt ? "Diarsipkan" : !isPublished(item) ? "Tidak dipublikasikan" : demo.busyItemIds.includes(item.id) ? "Sedang dipinjam" : "Tersedia"}</span>
      <h1>{item.name}</h1><p className="location"><MapPin size={17} /> {item.campus} · {item.category}</p>
      <p>{item.description}</p>
      <dl className="facts"><div><dt>Kondisi</dt><dd>{item.condition}</dd></div><div><dt>Kelengkapan</dt><dd>{item.contents}</dd></div><div><dt>Durasi maksimal</dt><dd>{item.maxDays} hari</dd></div><div><dt>Deposit demo</dt><dd>{item.bookingReady ? rupiah(item.deposit) : "Menunggu kelengkapan listing"}</dd></div></dl>
      <div className="owner"><span className="avatar">{accountInitials(owner)}</span><div><strong>{owner}</strong><small>Akun mahasiswa demo</small></div>{rating && <span className="rating"><Star size={15} /> {rating.toFixed(1)} <small>contoh</small></span>}</div>
      <div><h3>Titik serah terima</h3><p>{item.points.map((id) => locationFor(item.campus, id)?.name).filter(Boolean).join(" · ")}</p></div>
      <div className="detail-cta"><strong>{item.rate ? `${rupiah(item.rate)} / hari` : "Gratis"}</strong>{!demo.profile ? <Link className="secondary" href={loginPath(itemPath(item))}>Masuk untuk meminjam</Link> :
        admin ? <ListingActions item={item} demo={demo} /> :
        own ? <span className="muted">Barang milikmu</span> :
        demo.verificationStatus !== "approved" ? <Link className="secondary" href="/verifikasi">Verifikasi Mahasiswa</Link> :
        item.bookingReady ? <Link className="primary" href={itemPath(item) + "/ajukan"}>Ajukan peminjaman</Link> : <span className="muted">Pemesanan belum tersedia</span>}</div>
      <small>Belum termasuk biaya layanan {demoConfig.servicePercent}% dan deposit.</small>
      {own && <ListingActions item={item} demo={demo} />}
      {own && <div className="promotion-actions">
        {until && <p>Sisa promosi {Math.ceil((until - now) / 86400000)} hari (dibulatkan) · Berakhir {dateLabel(new Date(until).toISOString())}</p>}
        <div><Link className="secondary" href={itemPath(item) + "/promosikan"}>Promosikan Barang</Link></div>
      </div>}
    </section>
  </div></>;
}

function Application({ item, demo }: { item: Item; demo: Demo }) {
  const router = useRouter();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [point, setPoint] = useState(item.points.length === 1 ? item.points[0] : "");
  const [review, setReview] = useState(false);
  const [error, setError] = useState("");
  const estimate = quote(item, start, end);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const validation = validateRequest(item, demo.loans, demo.person, start, end, point);
    setError(validation);
    if (validation) return;
    if (!review) { setReview(true); return; }
    try { router.push(`/transaksi/${await requestLoan(item.id, start, end, point)}`); } catch (error) { setError(errorText(error)); }
  }
  return <><Back href={itemPath(item)}>Detail barang</Back><div className="page-heading"><h1>{review ? "Ringkasan pengajuan" : "Ajukan peminjaman"}</h1><p>{item.name} · {demo.names[item.owner]}</p></div>
    <form className="detail-grid" onSubmit={submit}>
      <section className="panel form-panel"><h2>Jadwal peminjaman</h2><p>Waktu menggunakan WIB. Durasi maksimal {item.maxDays} hari.</p>
        {review ? <dl className="facts"><div><dt>Mulai</dt><dd>{dateLabel(start)}</dd></div><div><dt>Pengembalian</dt><dd>{dateLabel(end)}</dd></div><div><dt>Titik serah terima</dt><dd>{locationFor(item.campus, point)?.name}</dd></div></dl> :
          <><label>Mulai (WIB)<input required type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} /></label>
          <label>Pengembalian (WIB)<input required type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} /></label>
          <label>Titik serah terima<select value={point} onChange={(event) => setPoint(event.target.value)}><option value="" disabled>Pilih lokasi</option>{item.points.map((id) => <option key={id} value={id}>{locationFor(item.campus, id)?.name}</option>)}</select></label></>}
        {error && <p role="alert" className="error">{error}</p>}
        <div className="form-actions">{review && <button type="button" className="secondary" onClick={() => { setReview(false); setError(""); }}>Ubah jadwal</button>}<button className="primary">{review ? "Kirim permintaan" : "Tinjau pengajuan"}</button></div>
      </section>
      <aside className="panel form-panel"><h2>Rincian biaya</h2><p>{estimate.days ? `${estimate.days} hari ditagih · durasi dibulatkan per 24 jam` : "Pilih jadwal untuk melihat biaya sewa."}</p><Costs {...estimate} /><div className="notice"><ShieldCheck size={21} /><p><strong>Pembayaran hanya simulasi</strong><br />Pembayaran tersedia setelah pemilik menyetujui. Deposit kembali penuh bila barang kembali sesuai kondisi atau transaksi dibatalkan sebelum serah terima.</p></div></aside>
    </form>
  </>;
}

function Dashboard({ demo }: { demo: Demo }) {
  const [tab, setTab] = useState<"borrower" | "owner">("borrower");
  const admin = demo.profile?.role === "admin";
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const items = new Map(demo.items.map(item => [item.id, item]));
  const keyword = query.trim().toLocaleLowerCase("id");
  const list = demo.loans.filter(loan => {
    if (!admin) return loan[tab] === demo.person;
    if (status && loan.status !== status) return false;
    return [items.get(loan.itemId)?.name, demo.names[loan.borrower], demo.names[loan.owner], loan.id]
      .join(" ").toLocaleLowerCase("id").includes(keyword);
  });
  const pageSize = 10;
  const pages = Math.max(1, Math.ceil(list.length / pageSize));
  const current = Math.min(page, pages);
  const visible = admin ? list.slice((current - 1) * pageSize, current * pageSize) : list;
  return <><div className="page-heading"><h1>{admin ? "Semua Transaksi" : "Transaksi"}</h1><p>Pantau permintaan, serah terima, dan pengembalian barang.</p></div>
    {admin ? <div className="filters transaction-filters">
      <label className="search"><Search size={19} /><input aria-label="Cari transaksi" value={query} placeholder="Cari barang, peminjam, pemilik, atau nomor transaksi" onChange={e => { setQuery(e.target.value); setPage(1); }} /></label>
      <label className="filter"><select aria-label="Status transaksi" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
        <option value="">Semua status</option>{[...statuses, "rejected" as const, "cancelled" as const].map(value => <option key={value} value={value}>{statusLabel(value)}</option>)}</select><ChevronDown size={14} /></label>
    </div> : <div className="tabs" aria-label="Jenis transaksi"><button aria-pressed={tab === "borrower"} onClick={() => setTab("borrower")}>Saya Meminjam</button><button aria-pressed={tab === "owner"} onClick={() => setTab("owner")}>Saya Meminjamkan</button></div>}
    {!list.length && <div className="panel empty"><Package size={30} /><h3>{admin && (keyword || status) ? "Transaksi tidak ditemukan" : "Belum ada transaksi"}</h3>{!admin && <Link className="secondary" href={tab === "owner" ? "/pasang" : "/"}>{tab === "owner" ? "Pasang barang" : "Cari barang"}</Link>}</div>}
    <div className="transaction-list">{visible.map((loan) => {
      const item = items.get(loan.itemId);
      if (!item) return null;
      return <Link className="panel transaction-row" href={loanPath(loan)} key={loan.id}>
        <Photo item={item} /><div><h3>{item.name}</h3>{admin ? <>
          <p>Peminjam {demo.names[loan.borrower]} · Pemilik {demo.names[loan.owner]}</p>
          <p>{dateLabel(loan.start)} – {dateLabel(loan.end)}</p>
        </> : <p>{demo.names[tab === "owner" ? loan.borrower : loan.owner]} · {dateLabel(loan.start)}</p>}</div>
        <span className="pill paid">{loan.status === "paid" && loanTotal(loan) === 0 ? "Siap serah terima" : statusLabel(loan.status)}</span><ChevronRight size={18} />
      </Link>;
    })}</div>
    {admin && pages > 1 && <nav className="form-actions" aria-label="Halaman transaksi">
      <button className="secondary" disabled={current === 1} onClick={() => setPage(current - 1)}>Sebelumnya</button>
      <span aria-live="polite">Halaman {current} dari {pages}</span>
      <button className="secondary" disabled={current === pages} onClick={() => setPage(current + 1)}>Berikutnya</button>
    </nav>}
  </>;
}

function Transaction({ loan, item, demo }: { loan: Loan; item: Item; demo: Demo }) {
  const [error, setError] = useState("");
  const [refunding, setRefunding] = useState(false);
  const admin = demo.profile?.role === "admin";
  const actions = admin ? [] : actionsFor(loan, demo.person);
  const receipt = (admin ? demo.admin?.receipts : demo.receipts)?.find(row => row.kind === "loan" && row.id === loan.id);
  const other = demo.person === loan.owner ? loan.borrower : loan.owner;
  const waiting = actionsFor(loan, other).some((action) => action.next !== "cancelled");
  const terminal = stepIndex(loan.status) < 0;
  const deposit = depositState(loan);
  const free = loanTotal(loan) === 0;
  return <><Back href="/transaksi">Semua transaksi</Back><div className="page-heading"><span className={`pill ${terminal ? "warm" : "paid"}`}>{free && loan.status === "paid" ? "Siap serah terima" : statusLabel(loan.status)}</span><h1>{item.name}</h1><p>Peminjam {demo.names[loan.borrower]} · Pemilik {demo.names[loan.owner]}</p></div>
    <div className="detail-grid transaction-detail">
      <section className="panel form-panel"><h2>Perjalanan peminjaman</h2>
        <ol className="timeline">{steps.map((text, index) => {
          const current = stepIndex(loan.status) === index;
          const entry = Object.entries(loan.history).find(([status]) => stepIndex(status as Loan["status"]) === index)?.[1];
          return <li key={text} className={current ? "current" : entry ? "done" : ""} aria-current={current ? "step" : undefined}><span>{entry && !current ? <Check size={14} /> : index + 1}</span><div><strong>{free && index === stepIndex("paid") ? "Pembayaran dilewati (Rp0)" : text}</strong>{entry && <small>{dateLabel(entry)}</small>}</div></li>;
        })}{terminal && <li className="stopped"><span>×</span><div><strong>{statusLabel(loan.status)}</strong><small>{dateLabel(loan.history[loan.status]!)}</small></div></li>}</ol>
        {!admin && waiting && !actions.some((action) => action.next !== "cancelled") && <p className="notice">Menunggu tindakan dari {demo.names[other]}.</p>}
        {actions.length > 0 && <div className="form-actions">{actions.map((action) => action.next === "paid" ?
          <Link key={action.next} className="primary" href={`/pembayaran/peminjaman/${loan.id}`}>Bayar QRIS simulasi</Link> :
          <button key={action.next} className={action.next === "rejected" || action.next === "cancelled" ? "secondary" : "primary"} onClick={async () => {
          try { await changeStatus(loan.id, action.next); setError(""); } catch (error) { setError(errorText(error)); }
        }}>{action.label}</button>)}</div>}
        {error && <p className="error" role="alert">{error}</p>}
      </section>
      <div className="side-stack"><section className="panel form-panel"><h2>Serah terima</h2><p className="location"><MapPin size={18} />{loan.point}</p><p className="location"><CalendarDays size={18} />{dateLabel(loan.start)}</p><p className="location"><Clock3 size={18} />Kembali {dateLabel(loan.end)}</p></section>
      <section className="panel form-panel"><h2>Pembayaran simulasi</h2><Costs {...loan} />
        {receipt && <dl className="facts"><div><dt>Bukti pembayaran simulasi</dt><dd>{receipt.id}</dd></div><div><dt>Berhasil dibayar</dt><dd>{dateLabel(receipt.paidAt)}</dd></div></dl>}
        {loan.history.paid && loan.servicePercent !== undefined && <p>Bagian sewa pemilik (simulasi) {rupiah(receipt?.ownerProceeds ?? loan.rental)}.</p>}
        {receipt?.serviceRefund && <p>Refund biaya layanan simulasi {rupiah(receipt.serviceRefund.amount)} · {dateLabel(receipt.serviceRefund.at)}</p>}
        {admin && receipt && receipt.service > 0 && !receipt.serviceRefund && loan.status === "cancelled" && !loan.history.handover && <details>
          <summary>Refund biaya layanan</summary>
          <form className="side-stack" onSubmit={async event => {
            event.preventDefault();
            const reason = String(new FormData(event.currentTarget).get("reason") ?? "");
            setRefunding(true);
            try { await refundServiceFee(loan.id, reason); setError(""); }
            catch (cause) { setError(errorText(cause)); }
            finally { setRefunding(false); }
          }}>
            <label>Alasan refund<textarea name="reason" required maxLength={400} /></label>
            <button className="secondary" disabled={refunding}>Konfirmasi refund simulasi {rupiah(receipt.service)}</button>
          </form>
        </details>}
        <div className="notice"><ShieldCheck size={20} /><p><strong>{deposit}</strong><br />Deposit terpisah dari biaya sewa. Pemeriksaan pengembalian dilakukan pemilik tanpa potongan otomatis.</p></div></section></div>
    </div>
  </>;
}

function Listing({ person, item }: { person: string; item?: Item }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [paid, setPaid] = useState(Boolean(item?.rate));
  const [photos, setPhotos] = useState(() => item ? listingPhotos(item) : []);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [campus, setCampus] = useState<Item["campus"]>(item?.campus ?? campuses[0]);
  const [points, setPoints] = useState<string[]>(item && validPoints(item.campus, item.points) ? item.points : [""]);
  const [estimate, setEstimate] = useState(() => item ? String(listingValuation(item.id) ?? "") : "");
  const amount = Number(estimate);
  const locations = campusLocations(campus);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "").trim();
    if (!["name", "description", "condition", "contents"].every(value) || !validPoints(campus, points)) {
      setError("Lengkapi nama, deskripsi, kondisi, kelengkapan, dan titik serah terima.");
      return;
    }
    if (busy || saving) return;
    setSaving(true);
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (snapshot().person !== person) throw new Error("Akun aktif telah berubah. Simpan dari akun yang sesuai.");
      const id = await addItem({ name: value("name"), description: value("description"), condition: value("condition"), contents: value("contents"), points, photos,
        category: value("category") as Item["category"], campus, rate: paid ? Number(value("rate")) : 0, maxDays: Number(value("maxDays")) }, amount, item?.id);
      router.push(`/barang/${id}`);
    } catch (error) {
      setSaving(false);
      setError(error instanceof DOMException && error.name === "QuotaExceededError" ? "Penyimpanan demo penuh. Gunakan foto berukuran lebih kecil." : errorText(error));
    }
  }
  return <><div className="page-heading"><h1>{item ? "Edit barang" : "Pasang barang"}</h1><p>Bagikan perlengkapanmu ke sesama mahasiswa BINUS.</p></div>
    <form className="detail-grid" onSubmit={submit}>
      <section className="panel form-panel"><h2>Informasi barang</h2>
        <label>Nama barang<input name="name" defaultValue={item?.name} required maxLength={80} placeholder="Contoh: Kabel HDMI 2 Meter" /></label>
        <PhotoEditor photos={photos} setPhotos={setPhotos} busy={busy || saving} setBusy={setBusy} published={!!item && isPublished(item)} />
        <div className="field-grid"><label>Kategori<select name="category" defaultValue={item?.category}>{categories.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Kampus<select name="campus" value={campus} onChange={(event) => { setCampus(event.target.value as Item["campus"]); setPoints([""]); }}>{campuses.map((value) => <option key={value}>{value}</option>)}</select></label></div>
        <label>Deskripsi<textarea name="description" defaultValue={item?.description} required maxLength={800} rows={3} /></label>
        <label>Kondisi<input name="condition" defaultValue={item?.condition} required maxLength={120} /></label>
        <label>Kelengkapan<input name="contents" defaultValue={item?.contents} required maxLength={180} /></label>
      </section>
      <section className="panel form-panel"><h2>Aturan peminjaman</h2>
        {points.map((id, index) => <div key={index}><label>Titik serah terima{index ? " tambahan" : ""}
          <select name="pointId" required value={id} onChange={(event) => setPoints(points.map((old, i) => i === index ? event.target.value : old))}>
            <option value="">Pilih lokasi</option>{locations.filter((place) => place.id === id || !points.includes(place.id)).map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
          </select></label>{index > 0 && <button type="button" className="secondary" onClick={() => setPoints(points.filter((_, i) => i !== index))}>Hapus titik tambahan</button>}</div>)}
        {points.every(Boolean) && points.length < locations.length && <div><button type="button" className="secondary" onClick={() => setPoints([...points, ""])}>Tambah titik serah terima</button></div>}
        <label>Jenis pinjaman<select value={paid ? "paid" : "free"} onChange={(event) => setPaid(event.target.value === "paid")}><option value="free">Gratis</option><option value="paid">Berbayar</option></select></label>
        {paid && <label>Tarif harian (Rp)<input name="rate" defaultValue={item?.rate} type="number" min={1} max={10000000} required /></label>}
        <label>Estimasi nilai barang (Rp)<input name="estimatedValue" type="number" min={1} max={Number.MAX_SAFE_INTEGER} step={1} required value={estimate} onChange={(event) => setEstimate(event.target.value)} /><small>Hanya terlihat oleh pemilik dan admin; digunakan sebagai dasar perhitungan deposit</small></label>
        <div className="field-grid"><label>Deposit otomatis (50%)<output aria-live="polite">{Number.isSafeInteger(amount) && amount > 0 ? rupiah(depositFor(amount)) : "Isi estimasi nilai barang"}</output></label>
        <label>Durasi maksimal (hari)<input name="maxDays" type="number" min={1} max={30} defaultValue={item?.maxDays ?? 3} required /></label></div>
        <div className="notice"><ShieldCheck size={20} /><p>Deposit dikembalikan penuh jika barang kembali sesuai kondisi dan kewajiban selesai.</p></div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="form-actions"><button className="primary" disabled={busy || saving}><Plus size={17} /> {saving ? "Menyimpan listing…" : item ? "Publikasikan perubahan" : "Simpan barang"}</button></div>
      </section>
    </form>
  </>;
}

function Access({ demo, admin = false }: { demo: Demo; admin?: boolean }) {
  const student = demo.profile?.role === "student";
  if (!admin && demo.profile?.role === "admin") return <section className="panel form-panel narrow">
    <h1>Halaman khusus mahasiswa</h1><Link className="secondary" href="/admin">Ke dashboard admin</Link>
  </section>;
  return <section className="panel form-panel narrow">
    <h1>{admin && demo.profile ? "Akses khusus admin" : student ? "Verifikasi Mahasiswa" : "Masuk ke BorrowBuddy"}</h1>
    <p>{admin ? "Akun ini tidak memiliki akses ke dashboard admin." : student ? "Verifikasi mahasiswa harus disetujui sebelum mengajukan peminjaman atau memasang barang." : "Masuk dengan akun mahasiswa untuk melanjutkan."}</p>
    <div className="form-actions">{admin && demo.profile ? <Link className="secondary" href="/">Kembali ke katalog</Link> :
      student ? <Link className="primary" href="/verifikasi">Buka verifikasi</Link> : <>
        <Link className="primary" href="/masuk">Masuk</Link><Link className="secondary" href="/daftar">Daftar akun</Link></>}</div>
  </section>;
}

function RouteContent({ route, demo }: { route: string[]; demo: Demo }) {
  const [page, id, subpage] = route;
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const current = Date.now();
    const next = demo.promotionWindows.reduce((closest, order) => {
      const boundaries = [Date.parse(order.startsAt ?? ""), Date.parse(order.endsAt ?? "")];
      return boundaries.reduce((time, boundary) => boundary > now ? Math.min(time, boundary) : time, closest);
    }, current + 60000);
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(1, next - current));
    return () => window.clearTimeout(timer);
  }, [demo.promotionWindows, now]);
  const verified = demo.profile?.role === "student" && demo.verificationStatus === "approved";
  if (page === "akses-ditolak") return <Access demo={demo} admin />;
  if (!page) return <Catalog demo={demo} now={now} />;
  if (route.length === 1) {
    if (page === "daftar" || page === "masuk") return <AuthForm online={demo.onlineDemo} key={page} register={page === "daftar"} />;
    if (page === "profil") return demo.profile ? <><Profile key={demo.person} demo={demo} /><ManagedListings demo={demo} /><Logout /></> : <Access demo={demo} />;
    if (page === "verifikasi") return demo.profile?.role === "student" ? <VerifyStudent key={demo.person} demo={demo} /> : <Access demo={demo} />;
    if (page === "admin") return demo.profile?.role === "admin" ? <><Admin demo={demo} now={now} /><ManagedListings demo={demo} admin /></> : <Access demo={demo} admin />;
    if (page === "pasang") return verified ? <Listing key={demo.person} person={demo.person} /> : <Access demo={demo} />;
  }
  if (page === "konfirmasi-email" && !id) return <ConfirmEmail online={demo.onlineDemo} />;
  if (page === "transaksi" && !demo.profile) return <Access demo={demo} />;
  if (page === "transaksi" && !id) return <Dashboard key={demo.person} demo={demo} />;
  if (page === "transaksi" && !subpage) {
    const loan = demo.loans.find((entry) => entry.id === id);
    const item = loan && demo.items.find((entry) => entry.id === loan.itemId);
    if (loan && item) return <Transaction key={id + demo.person} loan={loan} item={item} demo={demo} />;
  }
  if (page === "barang") {
    const item = demo.items.find((entry) => entry.id === id);
    if (item && demo.profile?.role === "admin" && (!subpage || subpage === "ajukan")) return <ItemDetail item={item} demo={demo} now={now} />;
    if (item && subpage === "edit" && item.owner === demo.person && verified && !item.archivedAt && !item.moderation?.length) return <Listing key={id + demo.person} person={demo.person} item={item} />;
    if (item && !isPublished(item) && item.owner === demo.person) return <><Back href="/profil">Barang saya</Back><ManagedListings demo={demo} /></>;
    if (item && !isPublished(item)) return <section className="panel empty"><h1>Listing tidak tersedia</h1><Link href="/">Kembali ke katalog</Link></section>;
    if (item && !subpage) return <ItemDetail item={item} demo={demo} now={now} />;
    if (item && subpage === "ajukan" && !item.bookingReady) return <ItemDetail item={item} demo={demo} now={now} />;
    if (item && subpage === "ajukan") return verified ? <Application key={id + demo.person} item={item} demo={demo} /> : <Access demo={demo} />;
    if (item && subpage === "promosikan" && verified && item.owner === demo.person) return <PromotionSummary key={item.id} item={item} orders={demo.promotions} now={now} />;
  }
  if (page === "pembayaran" && route.length === 3) {
    if (id === "peminjaman") {
      const loan = demo.loans.find((entry) => entry.id === subpage && entry.borrower === demo.person);
      if (loan && loanTotal(loan) > 0) return <Checkout key={loan.id + demo.person} bill={{ kind: "loan", loan }} />;
    }
    if (id === "promosi") {
      const order = demo.promotions.find((entry) => entry.id === subpage && entry.buyer === demo.person);
      const item = order && demo.items.find((item) => item.id === order.itemId && item.owner === demo.person);
      if (order && item) return <Checkout key={order.id + demo.person} bill={{ kind: "promotion", order, item }} />;
    }
  }
  return <div className="panel empty"><Package size={30} /><h1>Halaman tidak tersedia</h1><Link className="secondary" href="/">Kembali ke katalog</Link></div>;
}

export function BorrowBuddy({ route }: { route: string[] }) {
  const demo = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return <><Navigation demo={demo} route={route} /><main className="shell main">
    {demo.ready ? <RouteContent key={demo.person} route={route} demo={demo} /> : <p className="loading" role="status">{demo.error ?? "Memuat BorrowBuddy…"} </p>}
  </main><footer className="shell footer"><BrandLogo /></footer></>;
}
