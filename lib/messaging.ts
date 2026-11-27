import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "./supabase/admin";
import { sendSms, twilioConfigured } from "./twilio";
import { toE164 } from "./phone";

export type PhoneNumberRow = {
  id: string; business_id: string; location_id: string | null; e164: string; label: string; forward_to: string;
  record_calls: boolean; missed_call_text: boolean; missed_call_message: string; twilio_sid: string | null;
};

/** The public web address Twilio calls back to, e.g. https://app.caninecarcare.ca */
export function appUrl(path: string): string {
  const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  return base + path;
}
export const phoneReady = () => twilioConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) && Boolean(process.env.APP_URL);

/** The number to text or call from: the customer's location's number, else the first one. */
export async function pickNumber(db: SupabaseClient, businessId: string, locationId?: string | null): Promise<PhoneNumberRow | null> {
  const { data } = await db.from("phone_numbers").select("*").eq("business_id", businessId).order("created_at");
  const rows = (data ?? []) as PhoneNumberRow[];
  return rows.find((r) => locationId && r.location_id === locationId) ?? rows[0] ?? null;
}

export async function customerIdForPhone(db: SupabaseClient, businessId: string, e164: string): Promise<string | null> {
  const { data } = await db.from("customers").select("id").eq("business_id", businessId).eq("phone_e164", e164).order("created_at").limit(1).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/**
 * Records a text and sends it if texting is connected. If it isn't connected yet,
 * the text stays "queued" and goes out later from Phone settings.
 */
export async function queueAndSend(opts: {
  businessId: string; to: string; body: string; kind: string; customerId?: string | null; jobId?: string | null;
  locationId?: string | null; createdBy?: string | null;
}): Promise<{ ok: boolean; status: string; error?: string }> {
  const to = toE164(opts.to);
  const db = createAdminClient();
  const num = await pickNumber(db, opts.businessId, opts.locationId);
  const base = {
    business_id: opts.businessId, customer_id: opts.customerId ?? null, job_id: opts.jobId ?? null, channel: "sms",
    direction: "outbound", counterpart: to, to_address: to ?? opts.to, from_address: num?.e164 ?? "",
    phone_number_id: num?.id ?? null, body: opts.body, kind: opts.kind, created_by: opts.createdBy ?? null,
  };
  if (!to) {
    await db.from("messages").insert({ ...base, status: "skipped", error: "No valid phone number on file" });
    return { ok: false, status: "skipped", error: "There's no valid phone number on file." };
  }
  if (!phoneReady() || !num) {
    await db.from("messages").insert({ ...base, status: "queued", error: num ? null : "No business number set up yet" });
    return { ok: true, status: "queued" };
  }
  const { data: row } = await db.from("messages").insert({ ...base, status: "sending" }).select("id").single();
  return deliver(db, row!.id as string);
}

/** Sends one stored outbound message through Twilio and records what happened. */
export async function deliver(db: SupabaseClient, messageId: string): Promise<{ ok: boolean; status: string; error?: string }> {
  const { data: m } = await db.from("messages").select("*").eq("id", messageId).single();
  if (!m) return { ok: false, status: "failed", error: "Message not found" };
  let from = m.from_address as string, numberId = m.phone_number_id as string | null;
  if (!from) {
    const { data: c } = m.customer_id ? await db.from("customers").select("location_id").eq("id", m.customer_id).maybeSingle() : { data: null };
    const num = await pickNumber(db, m.business_id, (c?.location_id as string | undefined) ?? null);
    if (!num) return { ok: false, status: "queued", error: "No business number set up yet" };
    from = num.e164; numberId = num.id;
  }
  try {
    const r = await sendSms({ to: m.counterpart || m.to_address, from, body: m.body, statusCallback: appUrl("/api/twilio/status") });
    await db.from("messages").update({ status: "sent", provider_sid: r.sid, from_address: from, phone_number_id: numberId, sent_at: new Date().toISOString(), error: null }).eq("id", messageId);
    return { ok: true, status: "sent" };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Send failed";
    await db.from("messages").update({ status: "failed", error, from_address: from, phone_number_id: numberId }).eq("id", messageId);
    return { ok: false, status: "failed", error };
  }
}
