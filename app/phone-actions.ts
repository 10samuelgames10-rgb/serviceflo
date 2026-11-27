"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/context";
import { appUrl, deliver, phoneReady, pickNumber, queueAndSend, type PhoneNumberRow } from "@/lib/messaging";
import { firstName, toE164 } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { connectNumber, startCall } from "@/lib/twilio";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
function back(path: string, msg: string, key: "error" | "ok" = "error"): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(msg)}`);
}

/* ---------- texting ---------- */

export async function sendText(form: FormData) {
  const ctx = await getContext();
  const to = toE164(str(form, "to")), body = str(form, "body");
  const path = `/inbox?c=${encodeURIComponent(to ?? str(form, "to"))}`;
  if (!to) back("/inbox", "That phone number isn't valid.");
  if (!body) back(path, "Write a message first.");
  const { data: c } = await ctx.supabase.from("customers").select("id, location_id").eq("business_id", ctx.business.id).eq("phone_e164", to).limit(1).maybeSingle();
  const r = await queueAndSend({
    businessId: ctx.business.id, to, body, kind: "manual", customerId: (c?.id as string) ?? null,
    locationId: (c?.location_id as string) ?? (ctx.locationId !== "all" ? ctx.locationId : null), createdBy: ctx.user.id,
  });
  revalidatePath("/inbox");
  if (!r.ok) back(path, r.error ?? "That text didn't send.");
  if (r.status === "queued") back(path, "Saved. It will send once texting is connected in Phone settings.", "ok");
  redirect(path);
}

export async function sendOnMyWay(form: FormData) {
  const ctx = await getContext();
  const id = str(form, "id");
  const { data: job } = await ctx.supabase.from("jobs").select("id, location_id, employee_id, customer_id, customers(name, phone)").eq("id", id).eq("business_id", ctx.business.id).maybeSingle();
  if (!job) back("/calendar", "That job no longer exists.");
  const cust = job.customers as unknown as { name: string; phone: string };
  const tech = ctx.employees.find((e) => e.id === job.employee_id) ?? ctx.employees.find((e) => e.id === ctx.employeeId);
  const body = `Hi ${firstName(cust.name)}, ${tech ? `${firstName(tech.name)} from ` : ""}${ctx.business.name} is on the way! See you soon.`;
  const r = await queueAndSend({ businessId: ctx.business.id, to: cust.phone, body, kind: "on_my_way", customerId: job.customer_id as string, jobId: id, locationId: job.location_id as string, createdBy: ctx.user.id });
  revalidatePath(`/jobs/${id}`);
  if (!r.ok) back(`/jobs/${id}`, r.error ?? "That text didn't send.");
  back(`/jobs/${id}`, r.status === "queued" ? "\"On my way\" text saved. It will send once texting is connected." : "\"On my way\" text sent.", "ok");
}

export async function markConversationRead(counterpart: string) {
  const ctx = await getContext();
  const now = new Date().toISOString();
  await Promise.all([
    ctx.supabase.from("messages").update({ read_at: now }).eq("business_id", ctx.business.id).eq("counterpart", counterpart).eq("direction", "inbound").is("read_at", null),
    ctx.supabase.from("calls").update({ read_at: now }).eq("business_id", ctx.business.id).eq("counterpart", counterpart).is("read_at", null),
  ]);
}

export async function saveTexterAsCustomer(form: FormData) {
  const ctx = await getContext();
  const phone = toE164(str(form, "phone")), name = str(form, "name");
  if (!phone || !name) back(`/inbox?c=${encodeURIComponent(str(form, "phone"))}`, "Add a name to save them.");
  const loc = ctx.locationId !== "all" ? ctx.locationId : ctx.locations[0]?.id ?? null;
  const { data: c, error } = await ctx.supabase.from("customers").insert({ business_id: ctx.business.id, location_id: loc, name, phone, source: "text" }).select("id").single();
  if (error || !c) back(`/inbox?c=${encodeURIComponent(phone)}`, "Couldn't save that customer.");
  const db = createAdminClient();
  await Promise.all([
    db.from("messages").update({ customer_id: c.id }).eq("business_id", ctx.business.id).eq("counterpart", phone).is("customer_id", null),
    db.from("calls").update({ customer_id: c.id }).eq("business_id", ctx.business.id).eq("counterpart", phone).is("customer_id", null),
  ]);
  revalidatePath("/inbox");
  redirect(`/inbox?c=${encodeURIComponent(phone)}`);
}

/* ---------- calling ---------- */

/** Rings your mobile first; when you answer, it calls the customer from the business number. */
export async function callCustomer(form: FormData) {
  const ctx = await getContext();
  const to = toE164(str(form, "to"));
  const path = `/inbox?c=${encodeURIComponent(to ?? "")}`;
  if (!to) back("/inbox", "That phone number isn't valid.");
  if (!phoneReady()) back(path, "Calling isn't connected yet. An owner can set it up in Phone settings.");
  const me = ctx.employees.find((e) => e.id === ctx.employeeId);
  const myPhone = toE164(me?.phone);
  if (!myPhone) back(path, "Add your mobile number on the Team page first, so ServiceFlo knows which phone to ring.");
  const { data: c } = await ctx.supabase.from("customers").select("id, location_id").eq("business_id", ctx.business.id).eq("phone_e164", to).limit(1).maybeSingle();
  const num = await pickNumber(ctx.supabase, ctx.business.id, (c?.location_id as string) ?? null);
  if (!num) back(path, "Add a business number in Phone settings first.");
  const { data: call, error } = await ctx.supabase.from("calls").insert({
    business_id: ctx.business.id, phone_number_id: num.id, customer_id: (c?.id as string) ?? null,
    direction: "outbound", counterpart: to, status: "ringing",
  }).select("id").single();
  if (error || !call) back(path, "Couldn't start the call.");
  try {
    await startCall({ to: myPhone, from: num.e164, url: appUrl(`/api/twilio/bridge?call=${call.id}`) });
  } catch (e) {
    await createAdminClient().from("calls").update({ status: "failed" }).eq("id", call.id);
    back(path, e instanceof Error ? e.message : "The call didn't start.");
  }
  back(path, "Calling your phone now. Answer it and you'll be connected.", "ok");
}

/* ---------- phone settings (owners and managers) ---------- */

async function manager() {
  const ctx = await getContext();
  if (!ctx.isManager) redirect("/calendar");
  return ctx;
}

export async function savePhoneNumber(form: FormData) {
  const ctx = await manager();
  const id = str(form, "id");
  const e164 = toE164(str(form, "e164"));
  const fwd = str(form, "forward_to");
  const forward = fwd ? toE164(fwd) : "";
  if (!e164) back("/settings/phone", "The business number isn't valid. Use the full number, like +1 250 555 0123.");
  if (forward === null) back("/settings/phone", "The forwarding number isn't valid.");
  const row = {
    business_id: ctx.business.id, e164, label: str(form, "label"), location_id: str(form, "location") || null,
    forward_to: forward, record_calls: form.get("record_calls") === "on", missed_call_text: form.get("missed_call_text") === "on",
    missed_call_message: str(form, "missed_call_message") || "Sorry we missed your call! Want a quote? Reply here and we'll text you right back.",
  };
  const { error } = id
    ? await ctx.supabase.from("phone_numbers").update(row).eq("id", id).eq("business_id", ctx.business.id)
    : await ctx.supabase.from("phone_numbers").insert(row);
  if (error) back("/settings/phone", error.code === "23505" ? "That number is already set up." : "Couldn't save that number.");
  revalidatePath("/settings/phone");
  back("/settings/phone", "Saved.", "ok");
}

export async function connectPhoneNumber(form: FormData) {
  const ctx = await manager();
  if (!phoneReady()) back("/settings/phone", "Add the Twilio and app settings in Vercel first (see the checklist on this page).");
  const { data } = await ctx.supabase.from("phone_numbers").select("*").eq("id", str(form, "id")).eq("business_id", ctx.business.id).maybeSingle();
  const num = data as PhoneNumberRow | null;
  if (!num) back("/settings/phone", "Number not found.");
  try {
    const sid = await connectNumber(num.e164, appUrl("/api/twilio/sms"), appUrl("/api/twilio/voice"));
    await ctx.supabase.from("phone_numbers").update({ twilio_sid: sid }).eq("id", num.id);
  } catch (e) {
    back("/settings/phone", e instanceof Error ? e.message : "Couldn't connect that number.");
  }
  revalidatePath("/settings/phone");
  back("/settings/phone", "Connected. Calls and texts to this number now come into ServiceFlo.", "ok");
}

export async function sendQueuedTexts() {
  const ctx = await manager();
  if (!phoneReady()) back("/settings/phone", "Texting isn't connected yet.");
  const db = createAdminClient();
  const { data } = await db.from("messages").select("id").eq("business_id", ctx.business.id).eq("status", "queued").eq("direction", "outbound").order("created_at").limit(100);
  let sent = 0, failed = 0;
  for (const m of data ?? []) {
    const r = await deliver(db, m.id as string);
    if (r.ok) sent++; else failed++;
  }
  revalidatePath("/settings/phone");
  back("/settings/phone", `Sent ${sent} queued text${sent === 1 ? "" : "s"}${failed ? `, ${failed} failed` : ""}.`, "ok");
}

export async function setEmployeePhone(form: FormData) {
  const ctx = await getContext();
  const id = str(form, "id");
  if (!ctx.isManager && id !== ctx.employeeId) return;
  const raw = str(form, "phone");
  const phone = raw ? toE164(raw) : "";
  if (phone === null) back("/team", "That mobile number isn't valid.");
  await createAdminClient().from("employees").update({ phone }).eq("id", id).eq("business_id", ctx.business.id);
  revalidatePath("/team");
}
