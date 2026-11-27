import type { NextRequest } from "next/server";
import { appUrl, queueAndSend, type PhoneNumberRow } from "@/lib/messaging";
import { createAdminClient } from "@/lib/supabase/admin";
import { hangup, voicemail } from "@/lib/twiml";
import { forbidden, readTwilio, xml } from "@/lib/webhook";

/** Runs when the forwarded (or click-to-call) leg ends: answered, or missed. */
export async function POST(req: NextRequest) {
  const { ok, params } = await readTwilio(req);
  if (!ok) return forbidden();
  const db = createAdminClient();
  const callId = req.nextUrl.searchParams.get("call");
  const q = db.from("calls").select("*, phone_numbers(*), businesses(name)");
  const { data: call } = await (callId ? q.eq("id", callId) : q.eq("provider_sid", params.CallSid)).maybeSingle();
  if (!call) return xml(hangup());

  const answered = params.DialCallStatus === "completed";
  if (answered) {
    await db.from("calls").update({ status: "completed", duration_seconds: Number(params.DialCallDuration || 0) }).eq("id", call.id);
    return xml(hangup());
  }
  if (call.direction === "outbound") {
    const status = ["busy", "no-answer", "failed", "canceled"].includes(params.DialCallStatus) ? params.DialCallStatus : "no-answer";
    await db.from("calls").update({ status }).eq("id", call.id);
    return xml(hangup("The customer didn't answer."));
  }

  // Missed inbound call: text them back (at most once every 12 hours), then take a voicemail.
  await db.from("calls").update({ status: "missed" }).eq("id", call.id);
  const num = call.phone_numbers as PhoneNumberRow | null;
  if (num?.missed_call_text && call.counterpart?.startsWith("+")) {
    const since = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
    const { count } = await db.from("messages").select("id", { count: "exact", head: true })
      .eq("business_id", call.business_id).eq("counterpart", call.counterpart).eq("kind", "missed_call").gte("created_at", since);
    if (!count) {
      await queueAndSend({
        businessId: call.business_id, to: call.counterpart, body: num.missed_call_message, kind: "missed_call",
        customerId: call.customer_id, locationId: num.location_id,
      });
    }
  }
  const biz = call.businesses as { name: string } | null;
  return xml(voicemail({
    businessName: biz?.name ?? "We",
    actionUrl: appUrl("/api/twilio/voice/voicemail-done"),
    recordingCallback: appUrl("/api/twilio/voice/recording?type=voicemail"),
    transcribeCallback: appUrl("/api/twilio/voice/transcription"),
  }));
}
