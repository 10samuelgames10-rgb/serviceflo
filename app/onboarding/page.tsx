import { redirect } from "next/navigation";
import { Alert } from "@/components/Alert";
import { createClient } from "@/lib/supabase/server";
import { createBusiness, signOut } from "../actions";

export default async function Onboarding({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: member } = await supabase.from("members").select("business_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (member) redirect("/calendar");
  return (
    <main className="auth">
      <form className="panel" action={createBusiness}>
        <div className="panel-b" style={{ display: "grid", gap: 14 }}>
          <div className="brand"><span className="brand-mark">S</span>ServiceFlo</div>
          <h2 style={{ fontSize: 20 }}>Set up your business</h2>
          <p className="muted" style={{ margin: 0 }}>This takes 30 seconds. You can change everything later.</p>
          <Alert error={sp.error} />
          <div className="field"><label htmlFor="name">Business name</label><input className="in" id="name" name="name" required placeholder="Canine Car Care" /></div>
          <div className="field"><label htmlFor="owner">Your name</label><input className="in" id="owner" name="owner" placeholder="Samuel" /></div>
          <div className="field"><label htmlFor="locations">Locations (separate with commas)</label><input className="in" id="locations" name="locations" defaultValue="Victoria, Vancouver" /></div>
          <button className="btn pri" style={{ justifyContent: "center", padding: 10 }}>Create my business</button>
          <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
            Joining someone else&apos;s team instead? Ask them to add you, then sign in again.{" "}
            <button formAction={signOut} className="btn ghost sm" style={{ padding: 0, color: "var(--accent)" }}>Sign out</button>
          </p>
        </div>
      </form>
    </main>
  );
}
