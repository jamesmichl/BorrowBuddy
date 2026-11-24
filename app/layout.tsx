import type { Metadata } from "next";
import "@fontsource/archivo-black/latin-400.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "BorrowBuddy · Pinjam barang di kampus",
  description: "Katalog pinjam dan sewa barang antarmahasiswa BINUS.",
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
