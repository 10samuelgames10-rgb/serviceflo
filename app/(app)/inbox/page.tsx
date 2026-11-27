import Link from "next/link";
import { Alert } from "@/components/Alert";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Notice } from "@/components/Notice";
import { TopBar } from "@/components/TopBar";
import { callCustomer, saveTexterAsCustomer, sendText } from "@/app/phone-actions";
import { getContext } from "@/lib/context";
import { fmtDate, fmtTime } from "@/lib/format";
import { phoneReady } from "@/lib/messaging";
import { prettyPhone, toE164 } from "@/lib/phone";

type Msg = { id: string; counterpart: string; direction: string; body: string; media_urls: string[]; status: string; kind: string; created_at: string; read_at: string | null; error: string | null; customer_id: string | null; customers: { name: string } | null };
type Call = { id: string; counterpart: string; direction: string; status: string; duration_seconds: number; recording_url: string | null; voicemail_url: string | null; transcription: string | null; created_at: string; read_at: string | null; customer_id: string | null; customers: { name: string } | null };

const when = (iso: string, today: string) => {
  const d = new Date(iso), ds = iso.slice(0, 10);
  const t = fmtTime(d.getHours() + d.getMinutes() / 60);
  return ds === today ? t : `${fmtDate(ds)}, ${t}`;
};
const STATUS: Record<string, string> = { queued: "Waiting to send", sending: "Sending…", sent: "Sent", delivered: "Delivered", undelivered: "Not delivered", failed: "Failed", skipped: "Not sent" };
const CALL: Record<string, string> = { completed: "Call", missed: "Missed call", voicemail: "Voicemail", "no-answer": "No answer", busy: "Busy", failed: "Call failed", canceled: "Call cancelled", ringing: "Calling…", "in-progress": "Call in progress" };

export default async function Inbox({ searchParams }: { searchParams: Promise<{ c?: string; error?: string; ok?: string; new?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  const bid = ctx.business.id;
  const [{ data: m }, { data: c }] = await Promise.all([
    ctx.supabase.from("messages").select("id, counterpart, direction, body, media_urls, status, kind, created_at, read_at, error, customer_id, customers(name)").eq("business_id", bid).not("counterpart", "is", null).order("created_at", { ascending: false }).limit(800),
    ctx.supabase.from("calls").select("id, counterpart, direction, status, duration_seconds, recording_url, voicemail_url, transcription, created_at, read_at, customer_id, customers(name)").eq("business_id", bid).order("created_at", { ascending: false }).limit(400),
  ]);
  const msgs = (m ?? []) as unknown as Msg[], calls = (c ?? []) as unknown as Call[];

  type Conv = { counterpart: string; name: string | null; last: string; preview: string; unread: number };
  const convs = new Map<string, Conv>();
  const touch = (cp: string, at: string, preview: string, name: string | null, unread: boolean) => {
    const cur = convs.get(cp) ?? { counterpart: cp, name: null, last: "", preview: "", unread: 0 };
    if (at > cur.last) { cur.last = at; cur.preview = preview; }
    cur.name = cur.name ?? name;
    if (unread) cur.unread++;
    convs.set(cp, cur);
  };
  msgs.forEach((x) => touch(x.counterpart, x.created_at, (x.direction === "outbound" ? "You: " : "") + (x.body || "Photo"), x.customers?.name ?? null, x.direction === "inbound" && !x.read_at));
  calls.forEach((x) => touch(x.counterpart, x.created_at, `📞 ${CALL[x.status] ?? "Call"}`, x.customers?.name ?? null, x.direction === "inbound" && !x.read_at && (x.status === "missed" || x.status === "voicemail")));
  const list = [...convs.values()].sort((a, b) => b.last.localeCompare(a.last));

  const active = sp.c ? toE164(sp.c) : null;
  let thread: ({ t: "m"; at: string; m: Msg } | { t: "c"; at: string; c: Call })[] = [];
  let activeName: string | null = null;
  let activeCustomerId: string | null = null;
  if (active) {
    thread = [
      ...msgs.filter((x) => x.counterpart === active).map((x) => ({ t: "m" as const, at: x.created_at, m: x })),
      ...calls.filter((x) => x.counterpart === active).map((x) => ({ t: "c" as const, at: x.created_at, c: x })),
    ].sort((a, b) => a.at.localeCompare(b.at));
    const { data: cust } = await ctx.supabase.from("customers").select("id, name").eq("business_id", bid).eq("phone_e164", active).limit(1).maybeSingle();
    activeName = (cust?.name as string) ?? convs.get(active)?.name ?? null;
    activeCustomerId = (cust?.id as string) ?? null;
    // Opening a conversation marks it read.
    const now = new Date().toISOString();
    await Promise.all([
      ctx.supabase.from("messages").update({ read_at: now }).eq("business_id", bid).eq("counterpart", active).eq("direction", "inbound").is("read_at", null),
      ctx.supabase.from("calls").update({ read_at: now }).eq("business_id", bid).eq("counterpart", active).is("read_at", null),
    ]);
  }

  return (
    <>
      <TopBar title="Inbox" sub="Texts and calls to your business numbers">
        <Link className="btn pri" href="/inbox?new=1">+ New text</Link>
      </TopBar>
      <AutoRefresh />
      <div className="view stack">
        {!phoneReady() ? (
          <div className="notice">Texting and calling aren&apos;t connected yet. Texts you write here are saved and send once {ctx.isManager ? <Link href="/settings/phone">Phone settings</Link> : "an owner"} connects your Twilio numbers.</div>
        ) : null}
        <Alert error={sp.error} />
        <Notice ok={sp.ok} />
        <div className="inbox">
          <aside className="convs" aria-label="Conversations">
            {list.length === 0 ? <p className="muted" style={{ padding: 16, margin: 0 }}>No texts or calls yet.</p> : null}
            {list.map((cv) => (
              <Link key={cv.counterpart} href={`/inbox?c=${encodeURIComponent(cv.counterpart)}`} className={`conv ${cv.counterpart === active ? "on" : ""}`}>
                <span className="conv-top"><b>{cv.name ?? prettyPhone(cv.counterpart)}</b><small>{when(cv.last, ctx.today)}</small></span>
                <span className="conv-prev">{cv.preview}</span>
                {cv.unread && cv.counterpart !== active ? <span className="badge">{cv.unread}</span> : null}
              </Link>
            ))}
          </aside>
          <section className="thread">
            {sp.new ? (
              <form action={sendText} className="panel-b" style={{ display: "grid", gap: 10 }}>
                <h3 style={{ fontSize: 16 }}>New text</h3>
                <div className="field"><label htmlFor="to">To (mobile number)</label><input className="in" id="to" name="to" inputMode="tel" required placeholder="250 555 0123" /></div>
                <div className="field"><label htmlFor="body">Message</label><textarea className="in" id="body" name="body" rows={4} required /></div>
                <div><button className="btn pri">Send</button></div>
              </form>
            ) : !active ? (
              <p className="muted" style={{ padding: 24, margin: 0 }}>Pick a conversation, or start a new text.</p>
            ) : (
              <>
                <header className="thread-h">
                  <div style={{ minWidth: 0 }}>
                    <b style={{ fontSize: 16 }}>{activeName ?? prettyPhone(active)}</b>
                    <div className="muted" style={{ fontSize: 13 }}>{prettyPhone(active)}{activeCustomerId ? <> · <Link href={`/customers/${activeCustomerId}`}>Customer profile</Link></> : null}</div>
                  </div>
                  <form action={callCustomer}><input type="hidden" name="to" value={active} /><button className="btn">📞 Call</button></form>
                </header>
                {!activeCustomerId ? (
                  <form action={saveTexterAsCustomer} className="save-cust">
                    <input type="hidden" name="phone" value={active} />
                    <span className="muted">Not a customer yet.</span>
                    <input className="in" name="name" placeholder="Their name" aria-label="Their name" required style={{ maxWidth: 220 }} />
                    <button className="btn sm">Save as customer</button>
                  </form>
                ) : null}
                <div className="msgs">
                  {thread.map((it) => it.t === "m" ? (
                    <div key={it.m.id} className={`bubble ${it.m.direction === "outbound" ? "out" : "in"}`}>
                      {it.m.body ? <span style={{ whiteSpace: "pre-wrap" }}>{it.m.body}</span> : null}
                      {it.m.media_urls.map((_, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} src={`/api/media?msg=${it.m.id}&i=${i}`} alt="Photo they sent" className="mms" />
                      ))}
                      <small>{when(it.m.created_at, ctx.today)}{it.m.direction === "outbound" ? ` · ${STATUS[it.m.status] ?? it.m.status}${it.m.error && (it.m.status === "failed" || it.m.status === "skipped") ? `: ${it.m.error}` : ""}` : ""}{it.m.kind !== "manual" && it.m.kind !== "inbound" ? ` · ${it.m.kind.replace("_", " ")}` : ""}</small>
                    </div>
                  ) : (
                    <div key={it.c.id} className={`callcard ${it.c.status === "missed" || it.c.status === "voicemail" ? "miss" : ""}`}>
                      <b>📞 {it.c.direction === "outbound" ? "Outgoing" : "Incoming"} · {CALL[it.c.status] ?? it.c.status}{it.c.duration_seconds ? ` · ${Math.floor(it.c.duration_seconds / 60)}m ${it.c.duration_seconds % 60}s` : ""}</b>
                      <small>{when(it.c.created_at, ctx.today)}</small>
                      {it.c.voicemail_url ? <audio controls preload="none" src={`/api/media?call=${it.c.id}&f=voicemail`} /> : null}
                      {it.c.transcription ? <span className="muted">“{it.c.transcription}”</span> : null}
                      {it.c.recording_url ? <audio controls preload="none" src={`/api/media?call=${it.c.id}&f=recording`} /> : null}
                    </div>
                  ))}
                </div>
                <form action={sendText} className="composer">
                  <input type="hidden" name="to" value={active} />
                  <textarea className="in" name="body" rows={2} placeholder={`Text ${activeName ? activeName.split(" ")[0] : prettyPhone(active)}…`} aria-label="Message" required />
                  <button className="btn pri">Send</button>
                </form>
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
