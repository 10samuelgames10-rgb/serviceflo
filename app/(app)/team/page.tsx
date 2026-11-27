import { Alert } from "@/components/Alert";
import { TopBar } from "@/components/TopBar";
import { addEmployee } from "@/app/actions";
import { setEmployeePhone } from "@/app/phone-actions";
import { prettyPhone } from "@/lib/phone";
import { getContext } from "@/lib/context";
import { money } from "@/lib/format";

const COLORS = ["#0e9a87", "#d68708", "#c2418f", "#7b5cd6", "#2f7ae5", "#e05252"];

export default async function Team({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  const me = ctx.employees.find((e) => e.id === ctx.employeeId);
  if (!ctx.isManager) {
    return (
      <>
        <TopBar title="My phone" sub="Click-to-call rings this number first" />
        <div className="view" style={{ maxWidth: 520 }}>
          <form action={setEmployeePhone} className="panel panel-b" style={{ display: "grid", gap: 12 }}>
            <input type="hidden" name="id" value={me?.id ?? ""} />
            <div className="field"><label htmlFor="myphone">Your mobile number</label><input className="in" id="myphone" name="phone" inputMode="tel" defaultValue={prettyPhone(me?.phone)} placeholder="250 555 0111" /></div>
            <div><button className="btn pri">Save</button></div>
          </form>
        </div>
      </>
    );
  }
  return (
    <>
      <TopBar title="Team" sub="Everyone who can be assigned to jobs" />
      <div className="view two">
        <section className="panel">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Name</th><th>Role</th><th>Location</th><th>Mobile (for calls)</th><th className="r">Hourly wage</th><th>Login</th></tr></thead>
              <tbody>
                {ctx.employees.map((e) => (
                  <tr key={e.id}>
                    <td><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 99, background: e.color, marginRight: 8 }} />{e.name}</td>
                    <td>{e.role}</td>
                    <td>{ctx.locations.find((l) => l.id === e.location_id)?.name ?? "—"}</td>
                    <td>
                      <form action={setEmployeePhone} style={{ display: "flex", gap: 6 }}>
                        <input type="hidden" name="id" value={e.id} />
                        <input className="in" name="phone" inputMode="tel" defaultValue={prettyPhone(e.phone)} placeholder="250 555 0111" aria-label={`Mobile for ${e.name}`} style={{ width: 150, padding: "5px 8px" }} />
                        <button className="btn sm">Save</button>
                      </form>
                    </td>
                    <td className="r">{e.wage ? money(Number(e.wage), true) : "—"}</td>
                    <td>{e.user_id ? "Can sign in" : <span className="muted">Not invited yet</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel">
          <div className="panel-h"><h3>Add a team member</h3></div>
          <form action={addEmployee} className="panel-b" style={{ display: "grid", gap: 12 }}>
            <Alert error={sp.error} />
            <div className="grid2">
              <div className="field"><label htmlFor="name">Name</label><input className="in" id="name" name="name" required /></div>
              <div className="field"><label htmlFor="role">Role</label><input className="in" id="role" name="role" defaultValue="Detailer" /></div>
            </div>
            <div className="grid2">
              <div className="field"><label htmlFor="wage">Hourly wage ($)</label><input className="in" id="wage" name="wage" type="number" min="0" step="0.25" /></div>
              <div className="field"><label htmlFor="location">Location</label>
                <select className="in" id="location" name="location">{ctx.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
              </div>
            </div>
            <div className="field"><label htmlFor="color">Calendar colour</label>
              <select className="in" id="color" name="color">{COLORS.map((c, i) => <option key={c} value={c}>Colour {i + 1}</option>)}</select>
            </div>
            <div><button className="btn pri">Add to team</button></div>
            <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>Employee logins (so techs see only their own jobs and clock in) arrive in the next step.</p>
          </form>
        </section>
      </div>
    </>
  );
}
