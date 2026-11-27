import { redirect } from "next/navigation";
import { Alert } from "@/components/Alert";
import { Notice } from "@/components/Notice";
import { TopBar } from "@/components/TopBar";
import { connectPhoneNumber, savePhoneNumber, sendQueuedTexts } from "@/app/phone-actions";
import { getContext } from "@/lib/context";
import { appUrl, type PhoneNumberRow } from "@/lib/messaging";
import { prettyPhone } from "@/lib/phone";
import { twilioConfigured } from "@/lib/twilio";

export default async function PhoneSettings({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  if (!ctx.isManager) redirect("/calendar");
  const [{ data }, { count: queued }] = await Promise.all([
    ctx.supabase.from("phone_numbers").select("*").eq("business_id", ctx.business.id).order("created_at"),
    ctx.supabase.from("messages").select("id", { count: "exact", head: true }).eq("business_id", ctx.business.id).eq("status", "queued").eq("direction", "outbound"),
  ]);
  const numbers = (data ?? []) as PhoneNumberRow[];
  const checks = [
    ["Twilio account keys (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)", twilioConfigured()],
    ["Database access for incoming texts (SUPABASE_SERVICE_ROLE_KEY)", Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)],
    ["Your app's web address (APP_URL)", Boolean(process.env.APP_URL)],
  ] as const;
  const allSet = checks.every(([, ok]) => ok);

  const numberForm = (n?: PhoneNumberRow) => (
    <form action={savePhoneNumber} className="panel-b" style={{ display: "grid", gap: 12 }}>
      {n ? <input type="hidden" name="id" value={n.id} /> : null}
      <div className="grid3">
        <div className="field"><label htmlFor={`e-${n?.id ?? "new"}`}>Business number</label><input className="in" id={`e-${n?.id ?? "new"}`} name="e164" defaultValue={n ? prettyPhone(n.e164) : ""} placeholder="+1 250 555 0123" required /></div>
        <div className="field"><label htmlFor={`l-${n?.id ?? "new"}`}>Name</label><input className="in" id={`l-${n?.id ?? "new"}`} name="label" defaultValue={n?.label ?? ""} placeholder="Victoria line" /></div>
        <div className="field"><label htmlFor={`loc-${n?.id ?? "new"}`}>Location</label>
          <select className="in" id={`loc-${n?.id ?? "new"}`} name="location" defaultValue={n?.location_id ?? ctx.locations[0]?.id}>
            {ctx.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      </div>
      <div className="field"><label htmlFor={`f-${n?.id ?? "new"}`}>When someone calls, ring this mobile (leave blank to send every call to voicemail)</label><input className="in" id={`f-${n?.id ?? "new"}`} name="forward_to" defaultValue={n ? prettyPhone(n.forward_to) : ""} placeholder="Your cell, e.g. 250 555 0111" /></div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        <label className="chk"><input type="checkbox" name="missed_call_text" defaultChecked={n ? n.missed_call_text : true} />Text people back when a call is missed</label>
        <label className="chk"><input type="checkbox" name="record_calls" defaultChecked={n?.record_calls ?? false} />Record calls (callers hear “this call may be recorded”)</label>
      </div>
      <div className="field"><label htmlFor={`m-${n?.id ?? "new"}`}>Missed-call text</label><input className="in" id={`m-${n?.id ?? "new"}`} name="missed_call_message" defaultValue={n?.missed_call_message ?? "Sorry we missed your call! Want a quote? Reply here and we'll text you right back."} /></div>
      <div><button className="btn pri">{n ? "Save" : "Add number"}</button></div>
    </form>
  );

  return (
    <>
      <TopBar title="Phone settings" sub="Your business numbers for calls and texts" />
      <div className="view stack" style={{ maxWidth: 900 }}>
        <Alert error={sp.error} />
        <Notice ok={sp.ok} />
        <section className="panel">
          <div className="panel-h"><h3>Setup checklist</h3><span className={`pill`} style={{ ["--c" as string]: allSet ? "#22a36a" : "#f0b429" }}>{allSet ? "Ready" : "Not finished"}</span></div>
          <div className="panel-b" style={{ display: "grid", gap: 6 }}>
            {checks.map(([label, ok]) => <div key={label}>{ok ? "✅" : "⬜"} {label}</div>)}
            {!allSet ? <p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>Add the missing values in Vercel → Settings → Environment Variables, then redeploy. The step-by-step guide is in docs/PHONE_SETUP.md.</p> : null}
          </div>
        </section>
        {numbers.map((n) => (
          <section key={n.id} className="panel">
            <div className="panel-h">
              <h3>{n.label || prettyPhone(n.e164)}</h3>
              <span className="pill" style={{ ["--c" as string]: n.twilio_sid ? "#22a36a" : "#8a98b4" }}>{n.twilio_sid ? "Connected" : "Not connected"}</span>
              <span className="grow" />
              <form action={connectPhoneNumber}><input type="hidden" name="id" value={n.id} /><button className="btn sm" disabled={!allSet}>{n.twilio_sid ? "Reconnect" : "Connect to Twilio"}</button></form>
            </div>
            {numberForm(n)}
          </section>
        ))}
        <section className="panel">
          <div className="panel-h"><h3>Add a business number</h3></div>
          {numberForm()}
        </section>
        <section className="panel">
          <div className="panel-h"><h3>Texts waiting to send</h3></div>
          <div className="panel-b" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <span>{queued ?? 0} text{queued === 1 ? "" : "s"} saved while texting wasn&apos;t connected.</span>
            <form action={sendQueuedTexts}><button className="btn" disabled={!allSet || !queued}>Send them now</button></form>
          </div>
        </section>
        <section className="panel">
          <div className="panel-h"><h3>If you connect numbers by hand</h3></div>
          <div className="panel-b" style={{ display: "grid", gap: 6, fontSize: 13 }}>
            <span>“Connect to Twilio” does this for you. To do it yourself, open the number in Twilio and set:</span>
            <span>A message comes in → Webhook, POST → <code>{appUrl("/api/twilio/sms") || "https://YOUR-APP/api/twilio/sms"}</code></span>
            <span>A call comes in → Webhook, POST → <code>{appUrl("/api/twilio/voice") || "https://YOUR-APP/api/twilio/voice"}</code></span>
          </div>
        </section>
      </div>
    </>
  );
}
