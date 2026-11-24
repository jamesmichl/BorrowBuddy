import { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sampleVariants } from "@/lib/accounts";
import { actorFor, cookieName } from "@/server/auth";
import { demoVerificationEnabled } from "@/server/demo-mode";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, context: { params: Promise<{variant:string}> }) {
  const { variant } = await context.params;
  if (!demoVerificationEnabled() || !Object.hasOwn(sampleVariants,variant)) return new Response(null,{status:404});
  if (!await actorFor(request.cookies.get(cookieName)?.value)) return new Response(null,{status:401});
  const image = await readFile(join(process.cwd(),"server","samples",variant + ".png"));
  return new Response(new Uint8Array(image),{headers:{"Content-Type":"image/png","Cache-Control":"private, no-store"}});
}
