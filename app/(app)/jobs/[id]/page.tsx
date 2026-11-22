import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/Alert";
import { TopBar } from "@/components/TopBar";
import { rescheduleJob, saveJobDetails, setJobStatus, toggleChecklistItem } from "@/app/actions";
import { getContext } from "@/lib/context";
import { fmtDate, fmtTime, hrs, jobTotals, money, SIZES, statusInfo, timeToHours } from "@/lib/format";
import type { Customer, Job, Service } from "@/lib/types";

const STEPS = [["quote", "Quote"], ["scheduled", "Scheduled"], ["progress", "In Progress"], ["completed", "Completed"]] as const;

export default async function JobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await getContext();
  const { data } = await ctx.supabase.from("jobs").select("*, customers(*), services(*)").eq("id", id).eq("business_id", ctx.business.id).maybeSingle();
  if (!data) notFound();
  const job = data as Job & { customers: Customer; services: Service | null };
  const c = job.customers, svc = job.services;
  const t = jobTotals(job);
  const st = statusInfo(job.status);
  const idx = job.status === "paid" ? 3 : Math.max(0, STEPS.findIndex(([k]) => k === job.status));
  const checklist = svc?.checklist ?? [];
  const done = new Set(job.checklist_done);
  const tech = ctx.employees.find((e) => e.id === job.employee_id);
  const loc = ctx.locations.find((l) => l.id === job.location_id);
  const start = timeToHours(job.start_time);
  const locked = job.status === "paid" || job.status === "cancelled";

  return (
    <>
      <TopBar title={`${job.number} - ${c.vehicle || c.name}`} sub={`${fmtDate(job.date)} · ${fmtTime(start)}–${fmtTime(start + Number(job.duration_hours))}${loc ? ` · ${loc.name}` : ""}`}>
        <span className="pill" style={{ ["--c" as string]: st.color }}>{st.label}</span>
        <Link className="btn" href="/calendar">Back to calendar</Link>
      </TopBar>
      <div className="view stack" style={{ maxWidth: 1000 }}>
        <Alert error={sp.error} />

        {job.status === "cancelled" ? (
          <div className="card" style={{ padding: "14px 18px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <span>This job was cancelled.</span>
            <form action={setJobStatus}><input type="hidden" name="id" value={job.id} /><input type="hidden" name="status" value="scheduled" /><button className="btn sm">Restore as scheduled</button></form>
          </div>
        ) : (
          <>
            <div className="steps">
              {STEPS.map(([k, label], i) => (
                <form key={k} action={setJobStatus}>
                  <input type="hidden" name="id" value={job.id} /><input type="hidden" name="status" value={k} />
                  <button className={`${k} ${i > idx ? "future" : ""}`} disabled={job.status === "paid"}>{label}</button>
                </form>
              ))}
            </div>
            {job.status !== "paid" ? (
              <div className="cancelrow">
                <form action={setJobStatus} style={{ gridColumn: idx + 1 }}>
                  <input type="hidden" name="id" value={job.id} /><input type="hidden" name="status" value="cancelled" />
                  <button className="cancel">⊗&nbsp; CANCEL</button>
                </form>
              </div>
            ) : null}
          </>
        )}

        <section className="card">
          <div className="card-h"><h3>Customer</h3><Link className="btn sm" href={`/customers/${c.id}`}>Customer profile ›</Link></div>
          <div className="crow">
            <span className="av">{c.name.slice(0, 1).toUpperCase()}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17 }}>{c.name}</div>
              <div className="muted">{c.phone ? <a href={`tel:${c.phone}`} style={{ color: "inherit" }}>{c.phone}</a> : "No phone yet"}</div>
            </div>
          </div>
          <div className="crow">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="muted" style={{ fontSize: 13 }}>Address</div>
              <div style={{ fontSize: 15.5, overflowWrap: "anywhere" }}>{c.address || "No address yet"}</div>
            </div>
            {c.address ? <a className="btn sm" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`} target="_blank" rel="noopener noreferrer">Open in Maps</a> : null}
          </div>
        </section>

        <section className="card">
          <div className="card-h"><h3>Line Items</h3><span className="muted">{c.vehicle} · {SIZES[job.vehicle_size]}</span></div>
          <div className="tbl-wrap">
            <table className="lines">
              <thead><tr><th>Line Item</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
              <tbody><tr><td><b>{job.service_name} ({SIZES[job.vehicle_size]})</b></td><td>1</td><td>{money(Number(job.price), true)}</td><td><b>{money(Number(job.price), true)}</b></td></tr></tbody>
            </table>
          </div>
          {svc?.includes?.length ? (
            <div style={{ padding: "4px 18px 8px" }}>
              <div>Service includes:</div>
              <ul style={{ margin: "6px 0", paddingLeft: 20 }}>{svc.includes.map((x) => <li key={x}>{x}</li>)}</ul>
              <div className="muted">Estimated duration: <b>{hrs(Number(job.duration_hours))}</b></div>
            </div>
          ) : null}
          <div className="totals">
            <div><span>Subtotal</span><b>{money(Number(job.price), true)}</b></div>
            {Number(job.discount) ? <div className="muted"><span>Discount</span><span>-{money(Number(job.discount), true)}</span></div> : null}
            <div className="muted"><span>B.C. GST (5%)</span><span>+ {money(t.gst, true)}</span></div>
            <div className="big"><span>Total</span><b>{money(t.total, true)}</b></div>
            {t.tip ? <div className="muted"><span>Tip</span><span>{money(t.tip, true)}</span></div> : null}
            <div><span>Amount due</span><b>{job.status === "paid" ? "Paid in full" : money(t.total, true)}</b></div>
          </div>
          {job.status !== "paid" && job.status !== "cancelled" ? (
            <form action={setJobStatus} style={{ padding: "0 18px 18px" }}>
              <input type="hidden" name="id" value={job.id} /><input type="hidden" name="status" value="paid" />
              <button className="btn">Mark as paid</button> <span className="muted" style={{ fontSize: 12.5 }}>Card payment links arrive with the Stripe step.</span>
            </form>
          ) : null}
        </section>

        <div className="two">
          <section className="card">
            <div className="card-h"><h3>Checklist</h3><span className="muted">{done.size}/{checklist.length}</span></div>
            <div style={{ padding: "0 18px 16px" }}>
              <div className="prog" style={{ marginBottom: 8 }}><i style={{ width: `${checklist.length ? (done.size / checklist.length) * 100 : 0}%` }} /></div>
              {checklist.length === 0 ? <p className="muted">This service has no checklist yet.</p> : checklist.map((item, i) => (
                <form key={i} action={toggleChecklistItem} className={`check ${done.has(i) ? "done" : ""}`}>
                  <input type="hidden" name="id" value={job.id} /><input type="hidden" name="index" value={i} />
                  <button aria-label={`${done.has(i) ? "Untick" : "Tick"}: ${item}`}>{done.has(i) ? "✓" : ""}</button><span>{item}</span>
                </form>
              ))}
            </div>
          </section>

          <div className="stack">
            <section className="card">
              <div className="card-h"><h3>Details</h3></div>
              <form action={saveJobDetails} style={{ padding: "0 18px 18px", display: "grid", gap: 12 }}>
                <input type="hidden" name="id" value={job.id} />
                <div className="grid2">
                  <div className="field"><label htmlFor="employee">Tech</label>
                    <select className="in" id="employee" name="employee" defaultValue={job.employee_id ?? ""} disabled={ctx.role === "tech"}>
                      <option value="">Not assigned</option>
                      {ctx.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                    {ctx.role === "tech" ? <input type="hidden" name="employee" value={job.employee_id ?? ""} /> : null}
                  </div>
                  <div className="field"><label htmlFor="discount">Discount ($)</label><input className="in" id="discount" name="discount" type="number" min="0" step="1" defaultValue={Number(job.discount) || ""} disabled={locked} /></div>
                </div>
                {locked ? <input type="hidden" name="discount" value={Number(job.discount)} /> : null}
                <div className="field"><label htmlFor="notes">Notes for the tech</label><textarea className="in" id="notes" name="notes" rows={3} defaultValue={job.notes} /></div>
                <div><button className="btn pri">Save</button> {tech ? <span className="muted" style={{ fontSize: 12.5 }}>Assigned to {tech.name}</span> : null}</div>
              </form>
            </section>
            {!locked ? (
              <section className="card">
                <div className="card-h"><h3>Reschedule</h3></div>
                <form action={rescheduleJob} style={{ padding: "0 18px 18px", display: "grid", gap: 12 }}>
                  <input type="hidden" name="id" value={job.id} />
                  <div className="grid2">
                    <div className="field"><label htmlFor="date">Date</label><input className="in" type="date" id="date" name="date" defaultValue={job.date} /></div>
                    <div className="field"><label htmlFor="start">Start</label><input className="in" type="time" id="start" name="start" defaultValue={job.start_time.slice(0, 5)} /></div>
                  </div>
                  <label style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><input type="checkbox" name="notify" defaultChecked />Text {c.name.split(" ")[0]} the new time{c.phone ? "" : " (no phone on file)"}</label>
                  <div><button className="btn">Move job</button></div>
                </form>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
