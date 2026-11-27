import type { NextRequest } from "next/server";
import { appUrl, type PhoneNumberRow } from "@/lib/messaging";
import { createAdminClient } from "@/lib/supabase/admin";
import { bridgeCall, hangup } from "@/lib/twiml";
import { forbidden, readTwilio, xml } from "@/lib/webhook";

/** Click-to-call: your phone answered, so now ring the customer from the business number. */
export async function POST(req: NextRequest) {
  const { ok, params } = await readTwilio(req);
  if (!ok) return forbidden();
  const callId = req.nextUrl.searchParams.get("call") ?? "";
  const db = createAdminClient();
  const { data: call } = await db.from("calls").select("*, phone_numbers(*)").eq("id", callId).maybeSingle();
  const num = call?.phone_numbers as PhoneNumberRow | null;
  if (!call || !num) return xml(hangup("Sorry, that call couldn't be connected."));
  await db.from("calls").update({ status: "in-progress", provider_sid: params.CallSid }).eq("id", callId);
  return xml(bridgeCall({
    to: call.counterpart,
    callerId: num.e164,
    actionUrl: appUrl(`/api/twilio/voice/after?call=${callId}`),
    record: num.record_calls,
    recordingCallback: appUrl(`/api/twilio/voice/recording?type=call&call=${callId}`),
    whisperUrl: appUrl("/api/twilio/whisper"),
  }));
}
