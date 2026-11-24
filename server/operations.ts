import { categories, campuses, type Item, type Status } from "../lib/loans.ts";
import { domain, type State } from "./domain.ts";
import { loadState, persistState, withStore } from "./store.ts";
import { sessionActor } from "./auth.ts";

export class RequestError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
const invalid = () => new RequestError("Permintaan tidak valid.");
export function strings(args: unknown[], count: number) {
  if (args.length !== count || args.some(arg => typeof arg !== "string")) throw invalid();
  return args as string[];
}
function listing(raw: unknown) {
  if (!raw || typeof raw !== "object") throw invalid();
  const item = raw as Item;
  if (![item.name, item.description, item.condition, item.contents].every(v => typeof v === "string" && v.trim().length && v.length <= 10000)
    || !categories.includes(item.category) || !campuses.includes(item.campus) || !Array.isArray(item.points)
    || !Number.isSafeInteger(item.rate) || item.rate < 0 || !Number.isSafeInteger(item.maxDays) || item.maxDays < 1
    || !Array.isArray(item.photos) || !item.photos.every(p => typeof p === "string" && (/^tile:[0-5]$/.test(p) || /^data:image\/(?:jpeg|webp|png);base64,[\w+/]+=*$/.test(p)))) throw invalid();
  return item;
}
export function sessionView(token?: string) {
  return withStore(false, async store => domain(await loadState(store),await sessionActor(store,token),()=>{ throw new Error("Read-only view"); }).view());
}
export function operation(token: string | undefined, expected: unknown, op: string, args: unknown[]) {
  return withStore(true,async store => {
    const actor = await sessionActor(store,token);
    if (!actor) throw new RequestError("Masuk untuk melanjutkan.", 401);
    if (expected !== actor) throw new RequestError("Sesi telah berubah. Muat ulang halaman.", 409);
    const state = await loadState(store);
    let changed: State | undefined;
    const repo = domain(state, actor, next => { changed = next; });
    if (["reviewVerification", "refundServiceFee"].includes(op) && state.accounts[actor]?.role !== "admin") throw new RequestError("Akses ditolak.", 403);
    function run() {
      switch (op) {
        case "updateProfile": return repo.updateProfile(strings(args, 1)[0]);
        case "reviewVerification": {
          const [id, status, reason, submission] = strings(args, 4);
          return repo.reviewVerification(id, status as "approved" | "rejected" | "revision", reason, submission);
        }
        case "addItem": {
          if (args.length !== 2 && args.length !== 3 || typeof args[1] !== "number" || (args[2] != null && typeof args[2] !== "string")) throw invalid();
          return repo.addItem(listing(args[0]), args[1], args[2] ?? undefined);
        }
        case "removeListing": {
          const [id, action, reason] = strings(args, 3);
          return repo.removeListing(id, action as "hide" | "archive", reason);
        }
        case "requestLoan": {
          const [id, start, end, point] = strings(args, 4);
          return repo.requestLoan(id, start, end, point);
        }
        case "changeStatus": {
          const [id, next] = strings(args, 2);
          return repo.changeStatus(id, next as Status);
        }
        case "refundServiceFee": {
          const [id, reason] = strings(args, 2);
          return repo.refundServiceFee(id, reason);
        }
        case "createPromotion": return repo.createPromotion(strings(args, 1)[0]);
        case "confirmPayment": {
          const [kind, id] = strings(args, 2);
          if (kind !== "loan" && kind !== "promotion") throw invalid();
          return repo.completeSimulatedPayment(kind, id, actor, new Date());
        }
        default: throw new RequestError("Operasi tidak tersedia.", 404);
      }
    }
    const result = run();
    if (changed) await persistState(store,changed);
    return { result, view: repo.view() };
  });
}
