import { validNim, type OcrCheck } from "../lib/accounts.ts";
type Word = { text: string; confidence: number };
export function assessNim(lines: Word[][], nim: string, threshold: number, blurry: boolean): Pick<OcrCheck, "outcome" | "detected" | "confidence"> {
  const candidates = new Map<string, number>();
  let ambiguous = false;
  const label = /\b(?:N\.?I\.?M\.?|nomor induk mahasiswa)(?=\s|[:#-]|$)\s*[:#-]?\s*/i;
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i].map(w => w.text).join(" ");
    const match = label.exec(text);
    if (!match) continue;
    let value = text.slice(match.index + match[0].length).replace(/\s+\|\s*$/, "").trim();
    const start = text.slice(0,match.index).trim().split(/\s+/).filter(Boolean).length;
    let words = lines[i].slice(start).filter(w => w.text !== "|");
    if (!value && lines[i + 1]) {
      words = [...words, ...lines[i + 1]];
      value = lines[i + 1].map(w => w.text).join(" ").trim();
    }
    const digits = value.replace(/[ .-]/g, "");
    if (!validNim(digits)) { ambiguous = true; continue; }
    const confidence = Math.min(...words.map(w => w.confidence));
    candidates.set(digits, Math.max(confidence, candidates.get(digits) ?? 0));
  }
  if (blurry || ambiguous || candidates.size > 1) return { outcome: "uncertain" };
  const first = candidates.entries().next().value;
  if (!first) return { outcome: "missing" };
  const [detected, confidence] = first;
  return { outcome: confidence < threshold ? "uncertain" : detected === nim ? "match" : "mismatch", detected, confidence };
}
