import type { NextRequest } from "next/server";
import { RECORDING_NOTICE, say, twiml } from "@/lib/twiml";
import { forbidden, readTwilio, xml } from "@/lib/webhook";

/** Played to the customer before a recorded click-to-call connects. */
export async function POST(req: NextRequest) {
  const { ok } = await readTwilio(req);
  if (!ok) return forbidden();
  return xml(twiml(say(RECORDING_NOTICE)));
}
