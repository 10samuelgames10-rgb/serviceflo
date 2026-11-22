import Link from "next/link";
import { CalendarDrag } from "@/components/CalendarDrag";
import { TopBar } from "@/components/TopBar";
import { getContext } from "@/lib/context";
import {
  addDays, DOW, fmtDate, fmtTime, hrs, MONTHS, money, parseDate, statusInfo, STATUSES, ymd,
} from "@/lib/format";

type Row = {
  id: string; number: number; date: string; start_time: string; status: string; price: number; discount: number;
  duration_hours: number; employee_id: string | null; customers: { name: string; vehicle: string } | null;
};

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string; view?: string; d?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  const today = parseDate(ctx.today);
  const view = sp.view === "week" ? "week" : "month";

  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? parseDate(`${sp.m}-01`) : new Date(today.getFullYear(), today.getMonth(), 1);
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? "") ? parseDate(sp.d!) : today;
  const weekStart = addDays(anchor, -((anchor.getDay() + 6) % 7));

  const gridStart = view === "month" ? addDays(month, -((month.getDay() + 6) % 7)) : weekStart;
  const gridEnd = view === "month" ? addDays(gridStart, 41) : addDays(weekStart, 6);

  let q = ctx.supabase
    .from("jobs")
    .select("id, number, date, start_time, status, price, discount, duration_hours, employee_id, customers(name, vehicle)")
    .eq("business_id", ctx.business.id)
    .gte("date", ymd(gridStart))
    .lte("date", ymd(gridEnd))
    .order("start_time");
  if (ctx.locationId !== "all") q = q.eq("location_id", ctx.locationId);
  if (ctx.role === "tech") q = q.eq("employee_id", ctx.employeeId ?? "00000000-0000-0000-0000-000000000000");
  const { data } = await q;
  const jobs = (data ?? []) as unknown as Row[];

  // totals for the period on screen (not the padding days)
  const [r0, r1] = view === "month"
    ? [ymd(month), ymd(new Date(month.getFullYear(), month.getMonth() + 1, 0))]
    : [ymd(weekStart), ymd(addDays(weekStart, 6))];
  const counted = jobs.filter((j) => j.date >= r0 && j.date <= r1 && j.status !== "cancelled" && j.status !== "quote");
  const amount = (j: Row) => Math.max(0, Number(j.price) - Number(j.discount));
  const revenue = counted.reduce((a, j) => a + amount(j), 0);
  const collected = counted.filter((j) => j.status === "paid").reduce((a, j) => a + amount(j), 0);
  const hours = counted.reduce((a, j) => a + Number(j.duration_hours), 0);

  const byDate = new Map<string, Row[]>();
  jobs.forEach((j) => byDate.set(j.date, [...(byDate.get(j.date) ?? []), j]));

  const mkey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const prev = view === "month" ? `?m=${mkey(new Date(month.getFullYear(), month.getMonth() - 1, 1))}` : `?view=week&d=${ymd(addDays(weekStart, -7))}`;
  const next = view === "month" ? `?m=${mkey(new Date(month.getFullYear(), month.getMonth() + 1, 1))}` : `?view=week&d=${ymd(addDays(weekStart, 7))}`;
  const label = view === "month" ? `${MONTHS[month.getMonth()]} ${month.getFullYear()}` : `Week of ${fmtDate(ymd(weekStart))}`;
  const periodName = view === "month" ? MONTHS[month.getMonth()] : "Week";

  const canDrag = ctx.role !== "tech";
  const movable = (j: Row) => canDrag && j.status !== "paid" && j.status !== "cancelled";
  const dragProps = (j: Row) => movable(j)
    ? { draggable: true, "data-job": j.id, "data-date": j.date, "data-label": `${j.number} - ${j.customers?.vehicle || j.customers?.name || ""}` }
    : { draggable: false };
  const chip = (j: Row) => {
    const s = statusInfo(j.status);
    return (
      <Link key={j.id} href={`/jobs/${j.id}`} {...dragProps(j)} className={`chip ${j.status === "progress" ? "dark" : ""}`} style={{ ["--c" as string]: s.color }}
        title={`${j.customers?.name ?? ""} · ${fmtTime(j.start_time)} · ${s.label}`}>
        {j.number} - {j.customers?.vehicle || j.customers?.name}
      </Link>
    );
  };

  const weeks: Date[] = [];
  if (view === "month") for (let w = 0; w < 6; w++) {
    const ws = addDays(gridStart, w * 7);
    if (w > 0 && ws > month && ws.getMonth() !== month.getMonth()) break;
    weeks.push(ws);
  }

  return (
    <>
      <TopBar title={ctx.role === "tech" ? "My jobs" : "Calendar"} sub={ctx.locationId === "all" ? "All locations" : ctx.locations.find((l) => l.id === ctx.locationId)?.name}>
        {ctx.role !== "tech" ? <Link className="btn pri" href="/jobs/new">+ New job</Link> : null}
      </TopBar>
      <div className="view">
        <div className="cal">
          <div className="cal-head">
            <h2>{label}</h2>
            <div className="seg">
              <Link className={view === "month" ? "on" : ""} href={`?m=${mkey(view === "week" ? weekStart : month)}`}>Month</Link>
              <Link className={view === "week" ? "on" : ""} href={`?view=week&d=${view === "month" ? (mkey(month) === mkey(today) ? ctx.today : ymd(month)) : ymd(weekStart)}`}>Week</Link>
            </div>
            <div className="calnav">
              <Link href={prev} aria-label="Previous">‹</Link>
              <Link href={view === "month" ? "?" : `?view=week&d=${ctx.today}`}>TODAY</Link>
              <Link href={next} aria-label="Next">›</Link>
            </div>
            <div className="tiles">
              {ctx.role === "tech" ? (
                <>
                  <div className="tile hero"><span>Your jobs</span><b>{counted.length}</b></div>
                  <div className="tile"><span>Scheduled work</span><b>{hrs(hours)}</b></div>
                </>
              ) : (
                <>
                  <div className="tile hero"><span>{periodName} revenue</span><b>{money(revenue)}</b></div>
                  <div className="tile"><span>Collected</span><b>{money(collected)}</b></div>
                  <div className="tile"><span>Booked ahead</span><b>{money(revenue - collected)}</b></div>
                  <div className="tile"><span>Hours of work</span><b>{hrs(hours)}</b></div>
                </>
              )}
            </div>
          </div>

          {view === "month" ? (
            <div className="grid-wrap month">
              <div className="mgrid">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="dow">{d}</div>)}
                <div className="dow" style={{ textAlign: "right" }}>{ctx.role === "tech" ? "" : "Total"}</div>
                {weeks.map((ws) => {
                  let wk = 0;
                  const cells = [0, 1, 2, 3, 4, 5, 6].map((i) => {
                    const day = addDays(ws, i), ds = ymd(day), list = byDate.get(ds) ?? [];
                    list.forEach((j) => { if (j.status !== "cancelled" && j.status !== "quote") wk += amount(j); });
                    return (
                      <div key={ds} className={`cell ${day.getMonth() !== month.getMonth() ? "out" : ""}`} {...(canDrag ? { "data-drop-date": ds } : {})}>
                        <div className="dh">
                          <Link className={`dn ${ds === ctx.today ? "today" : ""}`} href={`?view=week&d=${ds}`}>
                            {day.getDate() === 1 ? <><b>{MONTHS[day.getMonth()].slice(0, 3)}</b>&nbsp;1</> : day.getDate()}
                          </Link>
                          {ctx.role !== "tech" ? <Link className="plus" href={`/jobs/new?date=${ds}`} aria-label={`Add job on ${fmtDate(ds)}`}>+</Link> : null}
                        </div>
                        {list.slice(0, 4).map(chip)}
                        {list.length > 4 ? <Link className="muted" style={{ fontSize: 12 }} href={`?view=week&d=${ds}`}>+{list.length - 4} more</Link> : null}
                      </div>
                    );
                  });
                  return [
                    ...cells,
                    <div key={`wk-${ymd(ws)}`} className="wk">
                      {ctx.role === "tech" ? null : <><span className="eyebrow">Week</span><span className="num">{money(wk)}</span></>}
                    </div>,
                  ];
                })}
              </div>
            </div>
          ) : (
            <div className="grid-wrap">
              <div className="wkcols">
                {[0, 1, 2, 3, 4, 5, 6].map((i) => {
                  const day = addDays(weekStart, i), ds = ymd(day), list = byDate.get(ds) ?? [];
                  const tot = list.filter((j) => j.status !== "cancelled" && j.status !== "quote").reduce((a, j) => a + amount(j), 0);
                  return (
                    <div key={ds} className="wkcol" {...(canDrag ? { "data-drop-date": ds } : {})}>
                      <h4 className={ds === ctx.today ? "today" : ""}><span>{DOW[day.getDay()]} {day.getDate()}</span>{ctx.role === "tech" ? null : <span className="muted">{money(tot)}</span>}</h4>
                      {list.map((j) => {
                        const s = statusInfo(j.status);
                        return (
                          <Link key={j.id} href={`/jobs/${j.id}`} {...dragProps(j)} className="wjob" style={{ ["--c" as string]: s.color, color: j.status === "progress" ? "#3d2f00" : "#fff" }}>
                            <b>{fmtTime(j.start_time)} · {j.number}</b>
                            {j.customers?.vehicle}<br />{j.customers?.name} · {hrs(Number(j.duration_hours))}
                          </Link>
                        );
                      })}
                      {ctx.role !== "tech" ? <Link className="muted" style={{ fontSize: 12 }} href={`/jobs/new?date=${ds}`}>+ Add job</Link> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view === "month" ? (
            <div className="agenda">
              {[...byDate.keys()].filter((d) => d >= r0 && d <= r1).sort().map((ds) => (
                <div key={ds} style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", display: "grid", gap: 6 }}>
                  <b style={{ fontSize: 13 }}>{fmtDate(ds)}{ds === ctx.today ? " · Today" : ""}</b>
                  {byDate.get(ds)!.map(chip)}
                </div>
              ))}
            </div>
          ) : null}

          <div className="legend">
            {STATUSES.map((s) => <span key={s.id} style={{ ["--c" as string]: s.color }}><i />{s.label}</span>)}
          </div>
        </div>
        {canDrag ? <p className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>Tip: drag a job onto another day to reschedule it. You&apos;ll choose whether the customer gets a text.</p> : null}
        {canDrag ? <CalendarDrag /> : null}
        {jobs.length === 0 ? (
          <p className="muted" style={{ marginTop: 14 }}>
            No jobs here yet. {ctx.role !== "tech" ? <Link href="/jobs/new">Book your first job</Link> : "Your manager will assign jobs to you."}
          </p>
        ) : null}
      </div>
    </>
  );
}
