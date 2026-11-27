import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hangup } from "@/lib/twiml";
import { forbidden, readTwilio, xml } from "@/lib/webhook";

/** The caller finished leaving a voicemail. */
export async function POST(req: NextRequest) {
  const { ok, params } = await readTwilio(req);
  if (!ok) return forbidden();
  if (params.RecordingUrl && params.CallSid) {
    await createAdminClient().from("calls").update({ status: "voicemail" }).eq("provider_sid", params.CallSid);
  }
  return xml(hangup("Thanks, we'll get back to you soon. Goodbye."));
}
