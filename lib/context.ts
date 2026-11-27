import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { isConfigured } from "./supabase/config";
import { createClient } from "./supabase/server";
import { todayIn } from "./format";
import type { Business, Employee, Location } from "./types";

export type Role = "owner" | "manager" | "tech";

/** Everything a signed-in page needs: who you are, your business, and the team. */
export const getContext = cache(async () => {
  if (!isConfigured) redirect("/setup");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("members")
    .select("role, business_id, employee_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!member) redirect("/onboarding");

  const bid = member.business_id as string;
  const [{ data: business }, { data: locations }, { data: employees }] = await Promise.all([
    supabase.from("businesses").select("id, name, brand_color, timezone").eq("id", bid).single(),
    supabase.from("locations").select("id, name, short").eq("business_id", bid).order("created_at"),
    supabase.from("employees").select("id, name, role, wage, color, location_id, active, user_id, phone").eq("business_id", bid).order("created_at"),
  ]);

  const cookieLoc = (await cookies()).get("sf_loc")?.value;
  const locs = (locations ?? []) as Location[];
  const role = member.role as Role;
  const isManager = role === "owner" || role === "manager";
  const biz = business as Business;

  return {
    supabase,
    user,
    role,
    isManager,
    employeeId: (member.employee_id as string | null) ?? null,
    business: biz,
    locations: locs,
    employees: (employees ?? []) as Employee[],
    locationId: locs.some((l) => l.id === cookieLoc) ? (cookieLoc as string) : "all",
    today: todayIn(biz.timezone || "America/Vancouver"),
  };
});

export type Ctx = Awaited<ReturnType<typeof getContext>>;
