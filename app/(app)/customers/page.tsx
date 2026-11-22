import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { getContext } from "@/lib/context";
import { fmtDate, money, parseDate } from "@/lib/format";
import type { Customer } from "@/lib/types";

type J = { customer_id: string; date: string; status: string; price: number; discount: number };

export default async function Customers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const ctx = await getContext();
  let cq = ctx.supabase.from("customers").select("*").eq("business_id", ctx.business.id).order("name").limit(1000);
  if (ctx.locationId !== "all") cq = cq.eq("location_id", ctx.locationId);
  if (q) cq = cq.or(`name.ilike.%${q.replace(/[%,()]/g, "")}%,phone.ilike.%${q.replace(/[%,()]/g, "")}%,vehicle.ilike.%${q.replace(/[%,()]/g, "")}%`);
  const [{ data: customers }, { data: jobs }] = await Promise.all([
    cq,
    ctx.supabase.from("jobs").select("customer_id, date, status, price, discount").eq("business_id", ctx.business.id).neq("status", "cancelled"),
  ]);
  const list = (customers ?? []) as Customer[];
  const stats = new Map<string, { visits: number; spent: number; last: string; next: string }>();
  ((jobs ?? []) as J[]).forEach((j) => {
    const s = stats.get(j.customer_id) ?? { visits: 0, spent: 0, last: "", next: "" };
    if (j.status === "paid") { s.visits++; s.spent += Number(j.price) - Number(j.discount); if (j.date > s.last) s.last = j.date; }
    if (j.date >= ctx.today && j.status !== "paid" && (!s.next || j.date < s.next)) s.next = j.date;
    stats.set(j.customer_id, s);
  });
  const status = (id: string) => {
    const s = stats.get(id);
    if (!s || !s.visits) return s?.next ? ["Booked", "#2f7ae5"] : ["New", "#8a98b4"];
    if (s.next) return ["Booked", "#2f7ae5"];
    const days = (parseDate(ctx.today).getTime() - parseDate(s.last).getTime()) / 864e5;
    return days > 120 ? ["Overdue", "#e05252"] : days > 75 ? ["Due soon", "#f0b429"] : ["On track", "#14a8b8"];
  };

  return (
    <>
      <TopBar title="Customers" sub={`${list.length} customer${list.length === 1 ? "" : "s"}`}>
        <Link className="btn pri" href="/jobs/new">+ New job</Link>
      </TopBar>
      <div className="view stack">
        <form style={{ display: "flex", gap: 8, maxWidth: 420 }}>
          <input className="in" name="q" defaultValue={q} placeholder="Search name, phone or vehicle" aria-label="Search customers" />
          <button className="btn">Search</button>
        </form>
        <div className="panel">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Customer</th><th>Status</th><th className="r">Visits</th><th className="r">Spent</th><th>Last service</th><th>Next booked</th></tr></thead>
              <tbody>
                {list.map((c) => {
                  const s = stats.get(c.id), [label, color] = status(c.id);
                  return (
                    <tr key={c.id}>
                      <td><Link className="rowlink" href={`/customers/${c.id}`}>{c.name}</Link><span className="sub">{c.vehicle || c.phone}</span></td>
                      <td><span className="pill" style={{ ["--c" as string]: color }}>{label}</span></td>
                      <td className="r">{s?.visits ?? 0}</td>
                      <td className="r">{money(s?.spent ?? 0)}</td>
                      <td>{s?.last ? fmtDate(s.last) : "—"}</td>
                      <td>{s?.next ? fmtDate(s.next) : "—"}</td>
                    </tr>
                  );
                })}
                {list.length === 0 ? <tr><td colSpan={6} className="muted">{q ? "No customers match that search." : "No customers yet. They're added automatically when you book a job."}</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
