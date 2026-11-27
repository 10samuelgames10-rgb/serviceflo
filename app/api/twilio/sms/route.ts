import type { NextRequest } from "next/server";
import { customerIdForPhone, type PhoneNumberRow } from "@/lib/messaging";
import { toE164 } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { twiml } from "@/lib/twiml";
import { forbidden, readTwilio, xml } from "@/lib/webhook";

/** A customer texted one of your business numbers. */
export async function POST(req: NextRequest) {
  const { ok, params } = await readTwilio(req);
  if (!ok) return forbidden();
  const db = createAdminClient();
  const { data } = await db.from("phone_numbers").select("*").eq("e164", params.To).maybeSingle();
  const num = data as PhoneNumberRow | null;
  if (!num) return xml(twiml());

  const from = toE164(params.From) ?? params.From;
  const media = Array.from({ length: Number(params.NumMedia || 0) }, (_, i) => params[`MediaUrl${i}`]).filter(Boolean);
  const body = params.Body ?? "";
  if (!body.trim() && !media.length) return xml(twiml());

  await db.from("messages").upsert(
    {
      business_id: num.business_id, customer_id: await customerIdForPhone(db, num.business_id, from),
      channel: "sms", direction: "inbound", counterpart: from, from_address: from, to_address: num.e164,
      phone_number_id: num.id, body, media_urls: media, kind: "inbound", status: "received",
      provider_sid: params.MessageSid, created_by: null,
    },
    { onConflict: "provider_sid", ignoreDuplicates: true },
  );
  return xml(twiml());
}
