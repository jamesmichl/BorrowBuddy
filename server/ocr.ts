import { spawn } from "node:child_process";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { type OcrCheck, verificationPhotoLimit } from "../lib/accounts.ts";
import { sampleHashes } from "./sample-hashes.ts";
import { demoVerificationEnabled } from "./demo-mode.ts";
import { onlineDemo } from "./hosting.ts";

const failure = "Pemeriksaan gagal diproses, silakan coba lagi";
export async function inspectPhoto(nim: string, photo: string, timeout = 45000) {
  const bytes = Buffer.from(photo.slice(photo.indexOf(",") + 1), "base64");
  if (bytes.length > verificationPhotoLimit) throw new Error("Gunakan JPG, PNG atau WebP maksimal 1,5 MB.");
  const digest = createHash("sha256").update(bytes).digest("hex");
  const sample = Object.values<string>(sampleHashes).includes(digest);
  if (onlineDemo() && !sample) throw new Error("Demo online hanya menerima gambar sintetis bawaan.");
  const threshold = Number(process.env.BORROWBUDDY_OCR_CONFIDENCE ?? 75);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) throw new Error(failure);
  if (sample && !demoVerificationEnabled()) throw new Error("Gambar contoh hanya tersedia untuk pengujian lokal.");
  const result = await new Promise<Pick<OcrCheck,"outcome"|"detected"|"confidence"> & { marked: boolean }>((resolve, reject) => {
    const worker = spawn(process.execPath, ["--experimental-strip-types", join(process.cwd(),"server","ocr-worker.mts")], { stdio: ["pipe","pipe","ignore"], windowsHide: true });
    const timer = setTimeout(() => { worker.kill(); reject(new Error(failure)); }, timeout);
    let output = "";
    worker.on("error", () => { clearTimeout(timer); reject(new Error(failure)); });
    worker.stdout.setEncoding("utf8").on("data", chunk => { output += chunk; });
    worker.stdin.on("error", () => {});
    worker.stdin.end(JSON.stringify({ nim, photo, threshold }));
    worker.on("close", code => {
      clearTimeout(timer);
      if (code === 2) return reject(new Error("Gambar tidak dapat dibaca. Gunakan JPG, PNG atau WebP yang valid."));
      if (code !== 0) return reject(new Error(failure));
      try { resolve(JSON.parse(output)); } catch { reject(new Error(failure)); }
    });
  });
  const { marked, ...fields } = result;
  const demo = sample || marked;
  if (demo && !demoVerificationEnabled()) throw new Error("Gambar contoh hanya tersedia untuk pengujian lokal.");
  return { demo, ocr: { ...fields, digest, checkedAt: new Date().toISOString() } };
}
