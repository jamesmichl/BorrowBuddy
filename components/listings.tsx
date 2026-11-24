"use client";

import { MoreHorizontal } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { catalogPhotoCapacity } from "@/lib/config";
import { validPoints } from "@/lib/locations";
import { listingValuation, removeListing, type snapshot } from "@/lib/demo";
import { rupiah, dateLabel, hasOpenLoans, isPublished, listingPhotos, type Item } from "@/lib/loans";

type Demo = ReturnType<typeof snapshot>;

type PhotoItem = Pick<Item, "name" | "photo" | "photos" | "tile">;
export function Photo({ item, src = listingPhotos(item)[0] }: { item: PhotoItem; src?: string }) {
  const [failed, setFailed] = useState("");
  if (!src) return <span className="muted">Foto perlu dilengkapi</span>;
  if (failed === src) return <div className="photo placeholder">Foto gagal dimuat</div>;
  if (src.startsWith("tile:")) return <div role="img" aria-label={item.name} className={`photo product-photo tile-${src.slice(5)}`} />;
  return <div className="photo"><Image src={src} alt={item.name} unoptimized fill onError={() => setFailed(src)} /></div>;
}

async function preparePhoto(file: File) {
  if (!file.size || file.size > 5 * 1024 * 1024) throw new Error("Ukuran foto harus antara 1 byte dan 5 MB.");
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const begins = (bytes: number[]) => bytes.every((byte, i) => header[i] === byte);
  const signature = String.fromCharCode(...header);
  if (!begins([255,216,255]) && !begins([137,80,78,71,13,10,26,10]) && !(signature.startsWith("RIFF") && signature.endsWith("WEBP"))) {
    throw new Error("Isi file harus berupa gambar JPG, PNG, atau WebP.");
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new window.Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, 1440 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error();
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL("image/webp", 0.8);
    if (!result.startsWith("data:image/")) throw new Error();
    return result;
  } catch { throw new Error("Gambar gagal dibaca. Coba file gambar lain."); }
  finally { URL.revokeObjectURL(url); }
}

export function PhotoEditor({ photos, setPhotos, busy, setBusy, published }: {
  photos: string[]; setPhotos: (photos: string[]) => void; busy: boolean; setBusy: (busy: boolean) => void; published: boolean;
}) {
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function load(files: File[], index?: number) {
    if (!files.length || lock.current) return;
    lock.current = true;
    setError(""); setBusy(true);
    try {
      const next = [...photos];
      for (const file of files) {
        const src = await preparePhoto(file);
        if (index === undefined) next.push(src); else next[index] = src;
        if (next.reduce((bytes, photo) => bytes + photo.length, 0) > catalogPhotoCapacity) throw new Error("Foto melebihi kapasitas demo 3 MB. Gunakan foto yang lebih kecil.");
      }
      setPhotos(next);
    } catch (error) { setError((error as Error).message); }
    finally { lock.current = false; setBusy(false); }
  }
  return <fieldset disabled={busy} className="photo-editor"><legend>Foto barang (wajib)</legend>
    <small>JPG, PNG, atau WebP hingga 5 MB per foto. Foto dioptimalkan dan disimpan saat publikasi. Kapasitas seluruh foto demo 3 MB setelah pengodean.</small>
    {photos.map((src, index) => <div className="editor-photo" key={index}>
      <Photo item={{ name: "Foto barang " + (index + 1) }} src={src} />
      <div><strong>{index === 0 ? "Foto utama" : "Foto " + (index + 1)}</strong>
        <label>Ganti foto<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ""; void load(files, index); }} /></label>
        <button type="button" className="secondary" disabled={published && photos.length === 1} onClick={() => setPhotos(photos.filter((_, i) => i !== index))}>Hapus foto</button>
      </div></div>)}
    <label>Tambah foto<input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ""; void load(files); }} /></label>
    {busy && <p role="status">Menyiapkan foto…</p>}
    {error && <p role="alert" className="error">{error}</p>}
  </fieldset>;
}

export function ListingActions({ item, demo, card = false }: { item: Item; demo: Demo; card?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const [action, setAction] = useState<"archive" | "hide">("archive");
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const admin = demo.profile?.role === "admin";
  if (item.archivedAt || (!admin && item.owner !== demo.person)) return null;
  const openLoan = hasOpenLoans(item.id, demo.loans);
  const hide = action === "hide" || openLoan;
  function choose(next: "archive" | "hide") {
    if (menu.current) menu.current.open = false;
    setError("");
    setReason("");
    setAction(next);
    dialog.current?.showModal();
  }
  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try { await removeListing(item.id, hide ? "hide" : "archive", reason.trim()); dialog.current?.close(); }
    catch (error) { setError((error as Error).message); }
    finally { setSaving(false); }
  }
  return <div className={card ? "card-moderation" : "form-actions"}>
    {admin ? <details className="moderation-menu" ref={menu}>
      <summary className="secondary" aria-label={`Kelola listing ${item.name}`}>{card ? <MoreHorizontal size={20} /> : "Kelola listing"}</summary>
      <div className="moderation-options">
        <Link href={`/barang/${item.id}`} onClick={() => { if (menu.current) menu.current.open = false; }}>Lihat detail</Link>
        <button type="button" disabled={item.active === false} onClick={() => choose("hide")}>Nonaktifkan listing</button>
        <button type="button" disabled={openLoan && item.active === false} onClick={() => choose("archive")}>Arsipkan listing</button>
      </div>
    </details> : <>
      {!item.moderation?.length && <Link className="secondary" href={`/barang/${item.id}/edit`}>{listingPhotos(item).length ? "Edit barang" : "Tambahkan Foto"}</Link>}
      <button className="secondary" onClick={() => choose("archive")}>Hapus Barang</button>
    </>}
    <dialog ref={dialog} className="listing-dialog" aria-label={`${hide ? "Nonaktifkan" : "Arsipkan"} ${item.name}`}>
      <form className="side-stack" onSubmit={confirm}>
        <h3>{hide ? "Nonaktifkan" : "Arsipkan"} {item.name}?</h3>
        <p>{openLoan ? "Barang memiliki transaksi yang belum selesai. Listing akan disembunyikan dari pemesanan baru. Transaksi aktif tetap dapat diselesaikan." : hide ? "Listing akan disembunyikan dari katalog dan promosi." : "Barang akan diarsipkan. Riwayat transaksi tetap bisa dibuka."}</p>
        {admin && <label>Alasan tindakan<textarea maxLength={400} required value={reason} onChange={(e) => setReason(e.target.value)} /></label>}
        {error && <p role="alert" className="error">{error}</p>}
        <div className="form-actions"><button type="button" className="secondary" onClick={() => dialog.current?.close()}>Batal</button>
          <button className="primary" disabled={saving || (admin && !reason.trim())}>{hide ? "Nonaktifkan pemesanan baru" : "Arsipkan barang"}</button></div>
      </form>
    </dialog>
  </div>;
}

export function ManagedListings({ demo, admin = false }: { demo: Demo; admin?: boolean }) {
  const items = demo.items.filter((item) => admin || item.owner === demo.person);
  return <section className="panel form-panel management"><h2>{admin ? "Pengelolaan listing" : "Barang saya"}</h2>
    {!items.length && <p>Belum ada barang.</p>}
    {items.map((item) => <article className="managed-item" key={item.id}><Photo item={item} />
      <div><h3>{item.name}</h3><p>{item.archivedAt ? "Diarsipkan" : !listingPhotos(item).length ? "Perlu dilengkapi" : isPublished(item) ? "Dipublikasikan" : "Nonaktif"}{admin && " · " + demo.names[item.owner]}</p>
        {admin && <p>Estimasi nilai barang: {listingValuation(item.id) ? rupiah(listingValuation(item.id)!) : "Belum diisi"}</p>}
        {!item.archivedAt && !item.bookingReady && <p className="notice">Lengkapi {[!listingValuation(item.id) && "estimasi nilai barang", !validPoints(item.campus, item.points) && "titik serah terima"].filter(Boolean).join(" dan ")} melalui Edit barang untuk menerima pemesanan.</p>}
        {item.moderation?.map((entry, i) => <p className="notice" key={i}>Pemberitahuan dari {demo.names[entry.actor]} · {dateLabel(entry.at)} · {entry.action === "hide" ? "Dinonaktifkan" : "Diarsipkan"} · {entry.reason}</p>)}
        <ListingActions item={item} demo={demo} />
      </div></article>)}
  </section>;
}
