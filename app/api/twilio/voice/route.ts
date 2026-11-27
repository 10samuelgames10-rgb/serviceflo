import type { NextRequest } from "next/server";
import { appUrl, customerIdForPhone, type PhoneNumberRow } from "@/lib/messaging";
import { toE164 } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { forwardCall, hangup, voicemail } from "@/lib/twiml";
import { forbidden, readTwilio, xml } from "@/lib/webhook";

/** Someone is calling one of your business numbers. */
export async function POST(req: NextRequest) {
  const { ok, params } = await readTwilio(req);
  if (!ok) return forbidden();
  const db = createAdminClient();
  const { data } = await db.from("phone_numbers").select("*").eq("e164", params.To).maybeSingle();
  const num = data as PhoneNumberRow | null;
  if (!num) return xml(hangup("Sorry, this number is not in service."));

  const from = toE164(params.From) ?? params.From ?? "unknown";
  await db.from("calls").upsert(
    {
      business_id: num.business_id, phone_number_id: num.id, customer_id: await customerIdForPhone(db, num.business_id, from),
      direction: "inbound", counterpart: from, status: "ringing", provider_sid: params.CallSid, started_by: null,
    },
    { onConflict: "provider_sid", ignoreDuplicates: true },
  );

  const { data: biz } = await db.from("businesses").select("name").eq("id", num.business_id).single();
  if (!num.forward_to) {
    return xml(voicemail({
      businessName: biz?.name ?? "We",
      actionUrl: appUrl("/api/twilio/voice/voicemail-done"),
      recordingCallback: appUrl("/api/twilio/voice/recording?type=voicemail"),
      transcribeCallback: appUrl("/api/twilio/voice/transcription"),
    }));
  }
  // Show the customer's number on your phone so you know who's calling.
  return xml(forwardCall({
    forwardTo: num.forward_to,
    callerId: from.startsWith("+") ? from : num.e164,
    actionUrl: appUrl("/api/twilio/voice/after"),
    record: num.record_calls,
    recordingCallback: appUrl("/api/twilio/voice/recording?type=call"),
  }));
}
