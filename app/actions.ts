"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { SIZE_EXTRA_HOURS, STATUSES, type Size, type Status } from "@/lib/format";
import { servicePrice, type Service } from "@/lib/types";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
function back(path: string, error: string): never {
  redirect(`${path}?error=${encodeURIComponent(error)}`);
}
const isSize = (v: string): v is Size => v === "sedan" || v === "suv" || v === "large";

/* ---------- sign in ---------- */

export async function signIn(form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: str(form, "email"), password: str(form, "password") });
  if (error) back("/login", "That email and password don't match. Try again or create an account.");
  redirect("/calendar");
}

export async function signUp(form: FormData) {
  const email = str(form, "email"), password = str(form, "password");
  if (password.length < 8) back("/login", "Use a password with at least 8 characters.");
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${origin}/auth/callback` } });
  if (error) back("/login", error.message);
  if (!data.session) redirect("/login?sent=1");
  redirect("/onboarding");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/* ---------- first-time setup ---------- */

export async function createBusiness(form: FormData) {
  const supabase = await createClient();
  const locations = str(form, "locations").split(",").map((s) => s.trim()).filter(Boolean);
  const { error } = await supabase.rpc("create_business", {
    p_name: str(form, "name"),
    p_owner_name: str(form, "owner"),
    p_locations: locations.length ? locations : ["Main"],
  });
  if (error) back("/onboarding", error.message);
  redirect("/calendar");
}

/* ---------- location switch ---------- */

export async function setLocation(form: FormData) {
  (await cookies()).set("sf_loc", str(form, "location") || "all", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}

/* ---------- jobs ---------- */

export async function createJob(form: FormData) {
  const ctx = await getContext();
  const bid = ctx.business.id;
  const size = str(form, "size");
  if (!isSize(size)) back("/jobs/new", "Pick a vehicle size.");
  const date = str(form, "date"), start = str(form, "start") || "09:00";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) back("/jobs/new", "Pick a date for the job.");

  const { data: service } = await ctx.supabase.from("services").select("*").eq("id", str(form, "service")).eq("business_id", bid).maybeSingle();
  if (!service) back("/jobs/new", "Pick a service.");
  const svc = service as Service;

  let customerId = str(form, "customer");
  const locationId = str(form, "location") || ctx.locations[0]?.id || null;
  if (!customerId) {
    const name = str(form, "name");
    if (!name) back("/jobs/new", "Add the customer's name, or pick an existing customer.");
    const { data: c, error } = await ctx.supabase
      .from("customers")
      .insert({
        business_id: bid, location_id: locationId, name, phone: str(form, "phone"), address: str(form, "address"),
        vehicle: str(form, "vehicle"), vehicle_size: size, source: str(form, "source") || "referral",
      })
      .select("id")
      .single();
    if (error || !c) back("/jobs/new", "Couldn't save the customer. Try again.");
    customerId = c!.id as string;
  }

  const override = str(form, "price");
  const price = override !== "" && Number(override) >= 0 ? Number(override) : servicePrice(svc, size as Size);
  const { data: job, error } = await ctx.supabase
    .from("jobs")
    .insert({
      business_id: bid, location_id: locationId, customer_id: customerId, service_id: svc.id,
      employee_id: str(form, "employee") || null, vehicle_size: size, service_name: svc.name, price,
      date, start_time: start, duration_hours: Number(svc.duration_hours) + SIZE_EXTRA_HOURS[size as Size],
      status: str(form, "status") === "quote" ? "quote" : "scheduled", notes: str(form, "notes"),
    })
    .select("id")
    .single();
  if (error || !job) back("/jobs/new", "Couldn't save the job. Check the details and try again.");
  revalidatePath("/calendar");
  redirect(`/jobs/${job!.id}`);
}

async function updateJob(id: string, patch: Record<string, unknown>) {
  const ctx = await getContext();
  const { error } = await ctx.supabase.from("jobs").update(patch).eq("id", id).eq("business_id", ctx.business.id);
  if (error) back(`/jobs/${id}`, "That change didn't save. Try again.");
  revalidatePath(`/jobs/${id}`);
  revalidatePath("/calendar");
}

export async function setJobStatus(form: FormData) {
  const status = str(form, "status") as Status;
  if (!STATUSES.some((s) => s.id === status)) return;
  await updateJob(str(form, "id"), { status });
}

export async function toggleChecklistItem(form: FormData) {
  const ctx = await getContext();
  const id = str(form, "id"), i = Number(str(form, "index"));
  const { data } = await ctx.supabase.from("jobs").select("checklist_done").eq("id", id).single();
  const done = new Set<number>((data?.checklist_done as number[]) ?? []);
  if (done.has(i)) done.delete(i);
  else done.add(i);
  await updateJob(id, { checklist_done: [...done].sort((a, b) => a - b) });
}

export async function saveJobDetails(form: FormData) {
  const discount = Math.max(0, Number(str(form, "discount")) || 0);
  await updateJob(str(form, "id"), {
    notes: str(form, "notes"),
    employee_id: str(form, "employee") || null,
    discount,
  });
}

export async function rescheduleJob(form: FormData) {
  const date = str(form, "date"), start = str(form, "start");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  await updateJob(str(form, "id"), { date, start_time: start || "09:00" });
}

/* ---------- customers ---------- */

export async function updateCustomer(form: FormData) {
  const ctx = await getContext();
  const id = str(form, "id"), size = str(form, "vehicle_size");
  const { error } = await ctx.supabase
    .from("customers")
    .update({
      name: str(form, "name"), phone: str(form, "phone"), email: str(form, "email"), address: str(form, "address"),
      vehicle: str(form, "vehicle"), ...(isSize(size) ? { vehicle_size: size } : {}),
    })
    .eq("id", id)
    .eq("business_id", ctx.business.id);
  if (error) back(`/customers/${id}`, "That change didn't save.");
  revalidatePath(`/customers/${id}`);
}

export async function addCustomerNote(form: FormData) {
  const ctx = await getContext();
  const id = str(form, "customer_id"), body = str(form, "body");
  if (!body) return;
  await ctx.supabase.from("customer_notes").insert({ business_id: ctx.business.id, customer_id: id, body });
  revalidatePath(`/customers/${id}`);
}

export async function deleteCustomerNote(form: FormData) {
  const ctx = await getContext();
  await ctx.supabase.from("customer_notes").delete().eq("id", str(form, "id")).eq("business_id", ctx.business.id);
  revalidatePath(`/customers/${str(form, "customer_id")}`);
}

/* ---------- team & services (owners and managers) ---------- */

export async function addEmployee(form: FormData) {
  const ctx = await getContext();
  if (!ctx.isManager) return;
  const name = str(form, "name");
  if (!name) back("/team", "Add the employee's name.");
  const { error } = await ctx.supabase.from("employees").insert({
    business_id: ctx.business.id, name, role: str(form, "role") || "Detailer",
    wage: Math.max(0, Number(str(form, "wage")) || 0), color: str(form, "color") || "#1f74e0",
    location_id: str(form, "location") || null,
  });
  if (error) back("/team", "Couldn't add that employee.");
  revalidatePath("/team");
}

export async function updateService(form: FormData) {
  const ctx = await getContext();
  if (!ctx.isManager) return;
  const num = (k: string) => Math.max(0, Number(str(form, k)) || 0);
  await ctx.supabase
    .from("services")
    .update({
      name: str(form, "name"), price_sedan: num("price_sedan"), price_suv: num("price_suv"),
      price_large: num("price_large"), duration_hours: num("duration_hours"), bookable: form.get("bookable") === "on",
    })
    .eq("id", str(form, "id"))
    .eq("business_id", ctx.business.id);
  revalidatePath("/services");
}
