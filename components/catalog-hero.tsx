import Image from "next/image";
import Link from "next/link";
import { ArrowDown, BookOpen, Paperclip, Repeat2 } from "lucide-react";

export function CatalogHero() {
  return <section className="catalog-hero" aria-labelledby="catalog-title">
    <h1 id="catalog-title">BUTUH SEBENTAR?<br /><span>PINJAM AJA.</span></h1>
    <p className="hero-intro">Perlengkapan kuliah dari sesama mahasiswa BINUS.<br /> Cari barang yang kamu butuhkan, tanpa harus beli lagi.</p>
    <div className="hero-stage">
      <svg className="hero-thread" viewBox="0 0 900 180" preserveAspectRatio="none" aria-hidden="true"><path d="M55 148C150 224 191 15 272 82S415 211 551 109 746 11 847 66" fill="none" stroke="currentColor" strokeWidth="1.4"/></svg>
      <aside className="study-note"><Paperclip className="paperclip" size={29} aria-hidden="true"/><BookOpen size={31} strokeWidth={1.7} aria-hidden="true"/><p>Buat tugas, presentasi,<br />atau kegiatan kampus.</p></aside>
      <div className="hero-feature">
        <Image src="/campus-buddies.svg" alt="Tas kampus dan kalkulator berjalan bersama" width={410} height={180} unoptimized />
        <div className="hero-actions"><a className="primary" href="#katalog">Cari barang <ArrowDown size={17}/></a><Link className="secondary" href="/pasang">Pasang barang</Link></div>
      </div>
      <aside className="community-note"><Repeat2 size={32} strokeWidth={2} aria-hidden="true"/><p>Pinjam dan sewakan<br />di komunitas BINUS.</p></aside>
    </div>
  </section>;
}
