export const dynamic = "force-dynamic";

import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { NavLinks } from "@/components/NavLinks";
import { getContext } from "@/lib/context";
import { setLocation, signOut } from "../actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getContext();
  const links = [
    { href: "/calendar", label: "Calendar" },
    { href: "/customers", label: "Customers" },
    { href: "/jobs/new", label: "New job" },
    ...(ctx.isManager ? [{ href: "/team", label: "Team" }, { href: "/services", label: "Services" }] : []),
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
