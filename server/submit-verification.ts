import { validateVerification, type Campus } from "../lib/accounts.ts";
import { sessionActor } from "./auth.ts";
import { withStore, loadState, persistState } from "./store.ts";
import { domain, type State } from "./domain.ts";
import { onlineDemo } from "./hosting.ts";
import { sampleHashes } from "./sample-hashes.ts";
import { RequestError, strings } from "./operations.ts";
import { inspectPhoto } from "./ocr.ts";

const running = new Set<string>();
export async function verifySubmission(token: string | undefined, expected: unknown, args: unknown[]) {
  const [nim,campus,photo] = strings(args,3);
  const { actor, previous } = await withStore(false,async store => {
    const actor = await sessionActor(store,token);
    if (!actor || actor !== expected) throw new RequestError("Masuk dengan akun yang sesuai.",401);
    const repo = domain(await loadState(store),actor,()=>{});
    repo.maySubmitVerification();
    return {actor,previous:repo.verificationDocument(actor)?.submittedAt};
  });
  validateVerification(nim,campus,photo);
  if (onlineDemo() && nim !== "1234567890") throw new RequestError("Gunakan NIM sintetis dari tombol Gunakan Data Contoh.");
  if (running.has(actor) || running.size >= 2) throw new RequestError("Pemeriksaan sedang berlangsung. Coba lagi sebentar.",429);
  running.add(actor);
  try {
    const checked = await inspectPhoto(nim,photo);
    return await withStore(true,async store => {
      if (await sessionActor(store,token) !== actor) throw new RequestError("Sesi telah berakhir.",401);
      let changed: State | undefined;
      const latest = domain(await loadState(store),actor,next => { changed = next; });
      if (latest.verificationDocument(actor)?.submittedAt !== previous) throw new RequestError("Pengajuan telah berubah. Muat ulang halaman.",409);
      latest.submitVerification(nim,campus as Campus,photo,checked);
      if (changed) {
        if (onlineDemo()) {
          const variant = Object.entries(sampleHashes).find(([,hash])=>hash === checked.ocr.digest)?.[0];
          if (!variant) throw new RequestError("Kartu sintetis tidak dikenali.");
          changed.verifications[actor][0].photo = "/api/verification/samples/" + variant;
        }
        await persistState(store,changed);
      }
      return { view: latest.view() };
    });
  } finally { running.delete(actor); }
}
