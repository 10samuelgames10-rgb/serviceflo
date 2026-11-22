import { Alert } from "@/components/Alert";
import { TopBar } from "@/components/TopBar";
import { createJob } from "@/app/actions";
import { getContext } from "@/lib/context";
import { money, SIZES, type Size } from "@/lib/format";
import type { Customer, Service } from "@/lib/types";

const TIMES = ["07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "11:00", "12:00", "12:30", "13:00", "13:30", "14:00", "15:00"];
const SOURCES = [["facebook", "Facebook Ads"], ["google", "Google Ads"], ["website", "Website form"], ["referral", "Referral"], ["booking", "Booking page"], ["repeat", "Repeat customer"]];

export default async function NewJob({ searchParams }: { searchParams: Promise<{ date?: string; customer?: string; error?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  const [{ data: services }, { data: customers }] = await Promise.all([
    ctx.supabase.from("services").select("*").eq("business_id", ctx.business.id).order("sort"),
    ctx.supabase.from("customers").select("id, name, vehicle, vehicle_size").eq("business_id", ctx.business.id).order("name").limit(2000),
  ]);
  const svcs = (services ?? []) as Service[];
  const custs = (customers ?? []) as Pick<Customer, "id" | "name" | "vehicle" | "vehicle_size">[];
  const preset = custs.find((c) => c.id === sp.customer);
  const defaultLoc = ctx.locationId !== "all" ? ctx.locationId : ctx.locations[0]?.id;

  return (
    <>
      <TopBar title="New job" sub="Book a job onto the calendar" />
      <div className="view">
        <form action={createJob} className="two">
          <div className="stack">
            <Alert error={sp.error} />
            <div className="panel">
              <div className="panel-h"><h3>Customer</h3></div>
              <div className="panel-b" style={{ display: "grid", gap: 12 }}>
                <div className="field">
                  <label htmlFor="customer">Existing customer</label>
                  <select className="in" id="customer" name="customer" defaultValue={preset?.id ?? ""}>
                    <option value="">New customer (fill in below)</option>
                    {custs.map((c) => <option key={c.id} value={c.id}>{c.name}{c.vehicle ? ` · ${c.vehicle}` : ""}</option>)}
                  </select>
                </div>
                <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>New customer? Leave the box above on &quot;New customer&quot; and fill these in.</p>
                <div className="grid2">
                  <div className="field"><label htmlFor="name">Name</label><input className="in" id="name" name="name" /></div>
                  <div className="field"><label htmlFor="phone">Phone</label><input className="in" id="phone" name="phone" inputMode="tel" /></div>
                </div>
                <div className="field"><label htmlFor="address">Address</label><input className="in" id="address" name="address" autoComplete="street-address" /></div>
                <div className="grid2">
                  <div className="field"><label htmlFor="vehicle">Vehicle</label><input className="in" id="vehicle" name="vehicle" placeholder="2021 Toyota RAV4" /></div>
                  <div className="field"><label htmlFor="referral">Referral code (optional)</label><input className="in" id="referral" name="referral" placeholder="MEGAN50" autoCapitalize="characters" /></div>
                </div>
                <div className="grid2">
                  <div className="field"><label htmlFor="source">How they found you</label>
                    <select className="in" id="source" name="source" defaultValue="referral">{SOURCES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
                  </div>
                  <p className="muted" style={{ margin: 0, fontSize: 12.5, alignSelf: "end" }}>A referral code links them to the customer who sent them. Every new customer gets their own code automatically.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="stack">
            <div className="panel">
              <div className="panel-h"><h3>Job</h3></div>
              <div className="panel-b" style={{ display: "grid", gap: 12 }}>
                <div className="grid2">
                  <div className="field"><label htmlFor="service">Service</label>
                    <select className="in" id="service" name="service" required>
                      {svcs.map((s) => <option key={s.id} value={s.id}>{s.name} · {money(Number(s.price_sedan))}–{money(Number(s.price_large))}</option>)}
                    </select>
                  </div>
                  <div className="field"><label htmlFor="size">Vehicle size</label>
                    <select className="in" id="size" name="size" defaultValue={preset?.vehicle_size ?? "suv"}>
                      {(Object.keys(SIZES) as Size[]).map((k) => <option key={k} value={k}>{SIZES[k]}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid2">
                  <div className="field"><label htmlFor="date">Date</label><input className="in" type="date" id="date" name="date" required defaultValue={sp.date ?? ctx.today} /></div>
                  <div className="field"><label htmlFor="start">Start time</label>
                    <select className="in" id="start" name="start" defaultValue="09:00">{TIMES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
                  </div>
                </div>
                <div className="grid2">
                  <div className="field"><label htmlFor="employee">Tech</label>
                    <select className="in" id="employee" name="employee" defaultValue="">
                      <option value="">Not assigned yet</option>
                      {ctx.employees.filter((e) => e.active).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  </div>
                  <div className="field"><label htmlFor="location">Location</label>
                    <select className="in" id="location" name="location" defaultValue={defaultLoc}>
                      {ctx.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid2">
                  <div className="field"><label htmlFor="price">Price (leave blank for the standard price)</label><input className="in" type="number" min="0" step="1" id="price" name="price" /></div>
                  <div className="field"><label htmlFor="status">Save as</label>
                    <select className="in" id="status" name="status" defaultValue="scheduled"><option value="scheduled">Scheduled job</option><option value="quote">Quote</option></select>
                  </div>
                </div>
                <div className="field"><label htmlFor="notes">Notes for the tech</label><textarea className="in" id="notes" name="notes" rows={3} placeholder="Gate code, dog in yard, where the outlet is…" /></div>
                <div><button className="btn pri">Save to calendar</button></div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
