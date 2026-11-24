import { createRequire } from "node:module";
import sharp from "sharp";
import Tesseract from "tesseract.js";
import { assessNim } from "./ocr-result.ts";

// Isolated process so a stalled recognizer, including its worker threads, can be stopped.
const model = createRequire(import.meta.url)("@tesseract.js-data/eng");
try {
  const input = JSON.parse((await Array.fromAsync(process.stdin.setEncoding("utf8"))).join(""));
  const buffer = Buffer.from(input.photo.slice(input.photo.indexOf(",") + 1), "base64");
  const image = sharp(buffer, { limitInputPixels: 20000000, failOn: "error" });
  let pixels: Buffer;
  try {
    const meta = await image.metadata();
    if (!["jpeg","png","webp"].includes(meta.format) || !input.photo.startsWith("data:image/" + meta.format + ";") || (meta.pages ?? 1) !== 1) throw new Error();
    pixels = await image.rotate().resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true }).flatten({ background: "white" }).greyscale().png().toBuffer();
  } catch { process.exit(2); }
  const stats = await sharp(pixels).stats();
  const worker = await Tesseract.createWorker("eng", Tesseract.OEM.LSTM_ONLY, { langPath: model.langPath, cacheMethod: "none", errorHandler: () => process.exit(1) });
  try {
    const { data } = await worker.recognize(pixels, {}, { blocks: true });
    const lines = (data.blocks ?? []).flatMap(b => b.paragraphs.flatMap(p => p.lines.map(l => l.words)));
    const result = assessNim(lines, input.nim, input.threshold, stats.entropy > 0.25 && stats.sharpness < 1.5);
    process.stdout.write(JSON.stringify({ ...result, marked: /BUKAN KTM ASLI/i.test(data.text) }));
  } finally { await worker.terminate(); }
} catch { process.exitCode = 1; }
