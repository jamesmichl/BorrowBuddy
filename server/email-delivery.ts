import { onlineDemo } from "./hosting.ts";
export const developmentEmailAllowed = () => onlineDemo() || ["development", "test"].includes(process.env.NODE_ENV ?? "");

export function emailDelivery() {
  const key = process.env.BORROWBUDDY_MAIL_KEY?.trim();
  const from = process.env.BORROWBUDDY_MAIL_FROM?.trim();
  const base = process.env.BORROWBUDDY_APP_URL?.trim();
  if (onlineDemo() || (developmentEmailAllowed() && (process.env.BORROWBUDDY_DEMO_EMAIL === "1" || (!key && !from && !base)))) {
    return { mode: "demo" } as const;
  }
  if (key && from && base) {
    try {
      const url = new URL(base);
      const allowed = url.protocol === "https:" || (!process.env.VERCEL && url.protocol === "http:" && ["localhost","127.0.0.1","[::1]"].includes(url.hostname));
      if (allowed && !url.username && !url.password) return { mode: "resend", key, from, base: url.origin } as const;
    } catch { /* Incomplete or invalid delivery configuration. */ }
  }
  return { mode: "unavailable" } as const;
}
