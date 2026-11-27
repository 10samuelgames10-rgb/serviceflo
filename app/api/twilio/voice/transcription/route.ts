import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { forbidden, readTwilio } from "@/lib/webhook";

/** Twilio finished turning a voicemail into text. */
export async function POST(req: NextRequest) {
  const { ok, params } = await readTwilio(req);
  if (!ok) return forbidden();
  if (params.TranscriptionStatus === "completed" && params.TranscriptionText && params.CallSid) {
    await createAdminClient().from("calls").update({ transcription: params.TranscriptionText }).eq("provider_sid", params.CallSid);
  }
  return new Response(null, { status: 204 });
}
