export const dynamic = "force-dynamic";

import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { NavLinks } from "@/components/NavLinks";
import { getContext } from "@/lib/context";
import { setLocation, signOut } from "../actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getContext();
  const [{ count: unreadTexts }, { count: unreadCalls }] = await Promise.all([
    ctx.supabase.from("messages").select("id", { count: "exact", head: true }).eq("business_id", ctx.business.id).eq("direction", "inbound").is("read_at", null),
    ctx.supabase.from("calls").select("id", { count: "exact", head: true }).eq("business_id", ctx.business.id).eq("direction", "inbound").in("status", ["missed", "voicemail"]).is("read_at", null),
  ]);
  const links = [
    { href: "/calendar", label: "Calendar" },
    { href: "/inbox", label: "Inbox", badge: (unreadTexts ?? 0) + (unreadCalls ?? 0) },
    { href: "/customers", label: "Customers" },
    { href: "/jobs/new", label: "New job" },
    { href: "/team", label: ctx.isManager ? "Team" : "My phone" },
    ...(ctx.isManager ? [{ href: "/services", label: "Services" }, { href: "/settings/phone", label: "Phone settings" }] : []),
  ];
  return (
    <div className="app">
      <aside className="rail">
        <div className="brand"><span className="brand-mark">S</span>ServiceFlo</div>
        <div className="biz">
          <div><small>Business</small><b>{ctx.business.name}</b></div>
        </div>
        {ctx.locations.length > 1 ? (
          <form action={setLocation} className="field">
            <label htmlFor="loc">Location</label>
            <AutoSubmitSelect className="in" id="loc" name="location" defaultValue={ctx.locationId}>
              <option value="all">All locations</option>
              {ctx.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </AutoSubmitSelect>
          </form>
        ) : null}
        <NavLinks links={links} />
        <div className="nav"><span className="soon">Coming next: Pipeline, Invoices, Payroll, Numbers, Facebook leads</span></div>
        <div className="rail-foot">
          <span className="muted">{ctx.user.email}</span>
          <form action={signOut}><button className="btn sm">Sign out</button></form>
        </div>
      </aside>
      <div className="main">{children}</div>
    </div>
  );
}
