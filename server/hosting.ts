export const onlineDemo = () => process.env.BORROWBUDDY_MODE === "online-demo";

export function usesPostgres() {
  if (process.env.VERCEL && !onlineDemo()) throw new Error("Aktifkan mode online-demo untuk deployment Vercel ini.");
  if (process.env.BORROWBUDDY_POSTGRES_URL) return true;
  if (process.env.VERCEL || onlineDemo()) throw new Error("Konfigurasi PostgreSQL untuk hosting belum tersedia.");
  return false;
}
