import { demoConfig } from "./config.ts";
import { campuses, people, type Person } from "./loans.ts";

export type Campus = typeof campuses[number];
export type VerificationStatus = "none" | "pending" | "approved" | "rejected" | "autoRejected" | "retake" | "revision";
export const verificationLabels: Record<VerificationStatus, string> = {
  none: "Belum diajukan", pending: "Menunggu pemeriksaan admin", approved: "Disetujui", rejected: "Ditolak oleh admin",
  autoRejected: "Ditolak otomatis", retake: "Perlu foto ulang", revision: "Perlu perbaikan",
};
export const nimPattern = "[0-9]{8,15}";
export const validNim = (value: string) => new RegExp("^" + nimPattern + "$").test(value);
export type OcrCheck = { outcome: "match" | "missing" | "mismatch" | "uncertain"; detected?: string; confidence?: number; checkedAt: string; digest: string };
export const sampleVariants = { match: "NIM cocok", mismatch: "NIM berbeda", missing: "Tanpa NIM" } as const;
export type SampleVariant = keyof typeof sampleVariants;
export const canSubmitVerification = (status: VerificationStatus) => status !== "pending" && status !== "approved";
export type Verification = {
  nim: string; campus: Campus; photo: string; submittedAt: string;
  id?: string; ocr?: OcrCheck; demo?: boolean;
  status: Exclude<VerificationStatus, "none">; reviewedAt?: string; reviewer?: Person; reason?: string;
};
export type Account = {
  name: string; email: string; confirmed: boolean; role: "student" | "admin"; example?: boolean;
  credential?: { salt: string; digest: string }; campus?: Campus; demoLoanAccess?: boolean; demoEmail?: true;
};
export const exampleAccounts: Record<Person, Account> = {
  raka: { name: people.raka.name, email: "raka@borrowbuddy.test", confirmed: true, role: "student", example: true },
  naya: { name: people.naya.name, email: "naya@borrowbuddy.test", confirmed: true, role: "student", example: true },
  admin: { name: "Admin Demo", email: "admin@borrowbuddy.test", confirmed: true, role: "admin", example: true },
};
export const accountInitials = (name: string) => name.split(/\s+/).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export function signupInput(name: string, email: string, password: string, confirmation: string, synthetic = false) {
  name = name.trim();
  email = normalizeEmail(email);
  if (name.length < 2 || name.length > 80) throw new Error("Nama lengkap harus berisi 2–80 karakter.");
  const match = /^[^\s@]+@([^\s@]+)$/.exec(email);
  if (synthetic && match?.[1] !== "student.borrowbuddy.test") throw new Error("Gunakan alamat fiktif dengan akhiran @student.borrowbuddy.test.");
  if (!match || !synthetic && !demoConfig.campusEmailDomains.some((domain) => domain === match[1]) || email.length > 254) {
    throw new Error("Gunakan format email kampus BINUS, misalnya nama@binus.ac.id.");
  }
  if (password.length < 8 || password.length > 128) throw new Error("Password harus berisi 8–128 karakter.");
  if (password !== confirmation) throw new Error("Konfirmasi password tidak sama.");
  return { name, email };
}
export const verificationPhotoLimit = 1_500_000;
export function validateVerification(nim: string, campus: string, photo: string) {
  if (!validNim(nim)) throw new Error("Masukkan NIM (8–15 digit).");
  if (!campuses.some((value) => value === campus)) throw new Error("Pilih kampus BINUS.");
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(photo) || photo.length > Math.ceil(verificationPhotoLimit / 3) * 4 + 32) {
    throw new Error("Gunakan contoh KTM atau unggah JPG, PNG, atau WebP maksimal 1,5 MB.");
  }
}
