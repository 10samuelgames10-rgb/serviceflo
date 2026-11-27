import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/Alert";
import { TopBar } from "@/components/TopBar";
import { addCustomerNote, deleteCustomerNote, updateCustomer } from "@/app/actions";
import { getContext } from "@/lib/context";
import { fmtDate, money, parseDate, SIZES, statusInfo, type Size } from "@/lib/format";
import type { Customer } from "@/lib/types";

type J = { id: string; number: number; date: string; status: string; price: number; discount: number; tip: number; service_name: string; employee_id: string | null };
type N = { id: string; body: string; created_at: string; created_by: string | null };
type M = { id: string; body: string; status: string; kind: string; created_at: string; error: string | null };
type Ref = { id: string; name: string; referral_code: string; created_at: string };

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await getContext();
  const [{ data: c }, { data: jobs }, { data: notes }, { data: referred }, { data: msgs }] = await Promise.all([
    ctx.supabase.from("customers").select("*").eq("id", id).eq("business_id", ctx.business.id).maybeSingle(),
    ctx.supabase.from("jobs").select("id, number, date, status, price, discount, tip, service_name, employee_id").eq("customer_id", id).order("date", { ascending: false }),
    ctx.supabase.from("customer_notes").select("id, body, created_at, created_by").eq("customer_id", id).order("created_at", { ascending: false }),
    ctx.supabase.from("customers").select("id, name, referral_code, created_at").eq("referred_by", id).eq("business_id", ctx.business.id).order("created_at"),
    ctx.supabase.from("messages").select("id, body, status, kind, created_at, error").eq("customer_id", id).order("created_at", { ascending: false }).limit(20),
  ]);
  if (!c) notFound();
  const cust = c as Customer;
  const refs = (referred ?? []) as Ref[];
  const messages = (msgs ?? []) as M[];
  const { data: referrer } = cust.referred_by
    ? await ctx.supabase.from("customers").select("id, name, referral_code").eq("id", cust.referred_by).maybeSingle()
    : { data: null };
  const js = (jobs ?? []) as J[];
  const paid = js.filter((j) => j.status === "paid").sort((a, b) => a.date.localeCompare(b.date));
  const spent = paid.reduce((a, j) => a + Number(j.price) - Number(j.discount), 0);
  const tips = paid.reduce((a, j) => a + Number(j.tip), 0);
  let freq = "One visit so far";
  if (paid.length >= 2) {
    const gap = (parseDate(paid[paid.length - 1].date).getTime() - parseDate(paid[0].date).getTime()) / 864e5 / (paid.length - 1);
    freq = gap < 60 ? `Every ~${Math.max(1, Math.round(gap / 7))} weeks` : `Every ~${Math.round(gap / 30)} months`;
  } else if (!paid.length) freq = "No paid visits yet";

  return (
    <>
      <TopBar title={cust.name} sub={`${cust.vehicle || "No vehicle yet"} · customer since ${fmtDate(cust.created_at.slice(0, 10))}`}>
        {cust.phone ? <Link className="btn" href={`/inbox?c=${encodeURIComponent(cust.phone)}`}>Text or call</Link> : null}
        <Link className="btn pri" href={`/jobs/new?customer=${cust.id}`}>Book next service</Link>
      </TopBar>
      <div className="view stack">
        <Alert error={sp.error} />
        <div className="tiles">
          <div className="tile"><span>Visits</span><b>{paid.length}</b></div>
          <div className="tile"><span>Lifetime spend</span><b>{money(spent)}</b></div>
          <div className="tile"><span>Average ticket</span><b>{money(paid.length ? spent / paid.length : 0)}</b></div>
          <div className="tile"><span>Frequency</span><b style={{ fontSize: 14 }}>{freq}</b></div>
          <div className="tile"><span>Tips given</span><b>{money(tips)}</b></div>
          <div className="tile hero"><span>Referral code</span><b>{cust.referral_code}</b></div>
          <div className="tile"><span>People referred</span><b>{refs.length}</b></div>
        </div>
        <div className="two">
          <div className="stack">
            <section className="panel">
              <div className="panel-h"><h3>Notes</h3><span className="muted" style={{ fontSize: 12 }}>Only your team sees these</span></div>
              <div className="panel-b" style={{ display: "grid", gap: 10 }}>
                <form action={addCustomerNote} style={{ display: "grid", gap: 8 }}>
                  <input type="hidden" name="customer_id" value={cust.id} />
                  <textarea className="in" name="body" rows={3} placeholder="Dogs, gate codes, preferences, upsell ideas…" aria-label="New note" required />
                  <div><button className="btn pri">Add note</button></div>
                </form>
                {((notes ?? []) as N[]).map((n) => (
                  <div key={n.id} className="note">
                    <span style={{ whiteSpace: "pre-wrap" }}>{n.body}</span>
                    <small>
                      <span>{fmtDate(n.created_at.slice(0, 10))}</span>
                      {ctx.isManager || n.created_by === ctx.user.id ? (
                        <form action={deleteCustomerNote}><input type="hidden" name="id" value={n.id} /><input type="hidden" name="customer_id" value={cust.id} /><button className="btn ghost sm danger" style={{ padding: 0 }}>Delete</button></form>
                      ) : null}
                    </small>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel">
              <div className="panel-h"><h3>Referrals</h3></div>
              <div className="panel-b" style={{ display: "grid", gap: 8 }}>
                <p style={{ margin: 0 }}>Their code is <code className="refcode">{cust.referral_code}</code>. When a new customer gives this code, enter it in the new job form and they&apos;re linked here.</p>
                {referrer ? <p style={{ margin: 0 }}>Referred by <Link href={`/customers/${referrer.id}`}>{referrer.name}</Link> ({referrer.referral_code})</p> : null}
                {refs.length ? (
                  <ul style={{ margin: 0, paddingLeft: 20 }}>{refs.map((r) => <li key={r.id}><Link href={`/customers/${r.id}`}>{r.name}</Link> <span className="muted">· joined {fmtDate(r.created_at.slice(0, 10))}</span></li>)}</ul>
                ) : <p className="muted" style={{ margin: 0 }}>Nobody has used their code yet.</p>}
              </div>
            </section>
            <section className="panel">
              <div className="panel-h"><h3>Texts</h3><span className="muted" style={{ fontSize: 12 }}>Queued texts send once texting is connected</span></div>
              <div className="panel-b" style={{ display: "grid", gap: 8 }}>
                {messages.length ? messages.map((m) => (
                  <div key={m.id} className="note" style={{ background: "#f5f9ff", borderColor: "var(--line)" }}>
                    <span>{m.body}</span>
                    <small><span>{fmtDate(m.created_at.slice(0, 10))} · {m.kind}</span><span>{m.status === "queued" ? "Queued" : m.status === "sent" ? "Sent" : m.status === "skipped" ? `Not sent: ${m.error ?? ""}` : `Failed: ${m.error ?? ""}`}</span></small>
                  </div>
                )) : <p className="muted" style={{ margin: 0 }}>No texts yet.</p>}
              </div>
            </section>
            <section className="panel">
              <div className="panel-h"><h3>Service history</h3></div>
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead><tr><th>Date</th><th>Job</th><th>Service</th><th>Status</th><th className="r">Amount</th></tr></thead>
                  <tbody>
                    {js.map((j) => {
                      const s = statusInfo(j.status);
                      return (
                        <tr key={j.id}>
                          <td>{fmtDate(j.date)}</td>
                          <td><Link href={`/jobs/${j.id}`}>{j.number}</Link></td>
                          <td>{j.service_name}<span className="sub">{ctx.employees.find((e) => e.id === j.employee_id)?.name ?? ""}</span></td>
                          <td><span className="pill" style={{ ["--c" as string]: s.color }}>{s.label}</span></td>
                          <td className="r">{money(Number(j.price) - Number(j.discount))}</td>
                        </tr>
                      );
                    })}
                    {js.length === 0 ? <tr><td colSpan={5} className="muted">No jobs yet.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
          <section className="panel">
            <div className="panel-h"><h3>Details</h3></div>
            <form action={updateCustomer} className="panel-b" style={{ display: "grid", gap: 12 }}>
              <input type="hidden" name="id" value={cust.id} />
              <div className="field"><label htmlFor="name">Name</label><input className="in" id="name" name="name" defaultValue={cust.name} required /></div>
              <div className="grid2">
                <div className="field"><label htmlFor="phone">Phone</label><input className="in" id="phone" name="phone" defaultValue={cust.phone} /></div>
                <div className="field"><label htmlFor="email">Email</label><input className="in" id="email" name="email" type="email" defaultValue={cust.email} /></div>
              </div>
              <div className="field"><label htmlFor="address">Address</label><input className="in" id="address" name="address" defaultValue={cust.address} /></div>
              <div className="grid2">
                <div className="field"><label htmlFor="vehicle">Vehicle</label><input className="in" id="vehicle" name="vehicle" defaultValue={cust.vehicle} /></div>
                <div className="field"><label htmlFor="vehicle_size">Size</label>
                  <select className="in" id="vehicle_size" name="vehicle_size" defaultValue={cust.vehicle_size}>
                    {(Object.keys(SIZES) as Size[]).map((k) => <option key={k} value={k}>{SIZES[k]}</option>)}
                  </select>
                </div>
              </div>
              <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>Found you through: {cust.source}</p>
              <div><button className="btn pri">Save details</button></div>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}
