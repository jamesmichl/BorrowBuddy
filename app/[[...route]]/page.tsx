import { BorrowBuddy } from "@/components/borrowbuddy";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { actorFor, cookieName } from "@/server/auth";
import { sessionView } from "@/server/operations";
import { loginDestination } from "@/server/login-destination";
import { loginPath } from "@/lib/login-path";

export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: {
  params: Promise<{ route?: string[] }>;
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { route = [] } = await params;
  if (route.join("/") === "admin/login") redirect(loginPath("/admin"));
  const token = (await cookies()).get(cookieName)?.value;
  const actor = await actorFor(token);
  if (!actor && (["admin", "profil", "verifikasi", "pasang", "transaksi", "pembayaran"].includes(route[0]) || route[0] === "barang" && route.length > 2)) {
    redirect(loginPath("/" + route.map(encodeURIComponent).join("/")));
  }
  if (actor && ["masuk", "daftar"].includes(route[0])) {
    const view = await sessionView(token);
    redirect(loginDestination((await searchParams).next, view));
  }
  if (route[0] === "admin" && (await sessionView(token)).profile?.role !== "admin") {
    return <BorrowBuddy route={["akses-ditolak"]} />;
  }
  return <BorrowBuddy route={route} />;
}
