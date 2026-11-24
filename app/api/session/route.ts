import { NextRequest, NextResponse } from "next/server";
import { actorFor, confirmEmail, confirmDemoRegistration, cookieName, demoEmailCookie, demoEmailLifetime, lifetime, register, registerDemoEmail, revoke, signIn } from "@/server/auth";
import { emailDelivery } from "@/server/email-delivery";
import { onlineDemo } from "@/server/hosting";
import { operation, RequestError, strings, sessionView } from "@/server/operations";
import { signupInput } from "@/lib/accounts";
import { verifySubmission } from "@/server/submit-verification";

export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(req: NextRequest) {
  try { return reply({ view: await sessionView(req.cookies.get(cookieName)?.value) }); }
  catch { return reply({ error: "Penyimpanan bersama belum tersedia." }, 503); }
}
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const localOrigin = (process.env.VERCEL ? "https:" : req.nextUrl.protocol) + "//" + req.headers.get("host");
  if ((origin && origin !== localOrigin) || !req.headers.get("content-type")?.startsWith("application/json")) return reply({ error: "Permintaan ditolak." }, 403);
  try {
    const body = await req.json();
    if (!body || typeof body.op !== "string" || !Array.isArray(body.args) || Object.keys(body).some(k => !["op","args","expectedActor"].includes(k))) throw new RequestError("Permintaan tidak valid.");
    const { op, args, expectedActor } = body;
    const token = req.cookies.get(cookieName)?.value;
    const cookie = { httpOnly: true, sameSite: "lax" as const, secure: !!process.env.VERCEL || req.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production" && !["localhost","127.0.0.1","[::1]"].includes(req.nextUrl.hostname), path: "/" };
    if (op === "login") {
      const [email, password] = strings(args, 2);
      if (await actorFor(token)) throw new RequestError("Keluar dari akun aktif sebelum masuk kembali.", 409);
      const session = await signIn(email, password, token);
      const response = reply({ result: session.role });
      response.cookies.set(cookieName, session.token, { ...cookie, maxAge: lifetime });
      return response;
    }
    if (op === "logout") {
      strings(args, 0);
      const actor = await actorFor(token);
      if (actor && expectedActor !== actor) throw new RequestError("Akun aktif telah berubah.", 409);
      await revoke(token);
      const response = reply({ result: true });
      response.cookies.set(cookieName, "", { ...cookie, maxAge: 0 });
      return response;
    }
    if (op === "signup") {
      const [name, email, password, confirmation] = strings(args, 4);
      const input = signupInput(name, email, password, confirmation, onlineDemo());
      const delivery = emailDelivery();
      if (delivery.mode === "demo") {
        const { ticket, proof } = await registerDemoEmail(name,email,password,confirmation);
        const response = reply({ result: { mode: "demo", ticket } });
        response.cookies.set(demoEmailCookie, proof, { ...cookie, sameSite: "strict", path: "/api/session", maxAge: demoEmailLifetime });
        return response;
      }
      if (delivery.mode === "unavailable") throw new RequestError("Layanan email konfirmasi belum dikonfigurasi. Hubungi pengelola untuk pendaftaran.", 503);
      const { key, from, base } = delivery;
      const url = new URL("/konfirmasi-email", base);
      url.hash = await register(name, email, password, confirmation);
      const sent = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: input.email, subject: "Konfirmasi email BorrowBuddy", text: "Konfirmasikan email dalam 24 jam melalui tautan ini.\n" + url.href }) }).catch(() => null);
      if (!sent?.ok) throw new RequestError("Email konfirmasi gagal dikirim. Ulangi pendaftaran dengan kredensial yang sama.", 503);
      return reply({ result: { mode: "sent" } });
    }
    if (op === "confirmDemoRegistration") {
      const [ticket] = strings(args, 1);
      await confirmDemoRegistration(ticket, req.cookies.get(demoEmailCookie)?.value);
      const response = reply({ result: true });
      response.cookies.set(demoEmailCookie, "", { ...cookie, sameSite: "strict", path: "/api/session", maxAge: 0 });
      return response;
    }
    if (op === "confirmEmail") {
      await confirmEmail(strings(args, 1)[0]);
      return reply({ result: true });
    }
    if (op === "submitVerification") return reply(await verifySubmission(token, expectedActor, args));
    return reply(await operation(token, expectedActor, op, args));
  } catch (error) {
    if (error instanceof RequestError) return reply({ error: error.message }, error.status);
    if (error instanceof Error && !("code" in error) && !(error instanceof TypeError || error instanceof SyntaxError)) return reply({ error: error.message }, 400);
    return reply({ error: "Permintaan gagal diproses." }, 400);
  }
}
