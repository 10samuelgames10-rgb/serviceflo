import { redirect } from "next/navigation";
import { isConfigured } from "@/lib/supabase/config";

export default function Setup() {
  if (isConfigured) redirect("/calendar");
  return (
    <main className="auth">
      <div className="panel">
        <div className="panel-b" style={{ display: "grid", gap: 12 }}>
          <div className="brand"><span className="brand-mark">S</span>ServiceFlo</div>
          <h2 style={{ fontSize: 20 }}>Almost ready</h2>
          <p style={{ margin: 0 }}>ServiceFlo needs its database connected before anyone can sign in.</p>
          <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
            <li>In Supabase, open your project, then <b>Project Settings → API</b>.</li>
            <li>Copy the <b>Project URL</b> and the <b>anon public</b> key.</li>
            <li>In Vercel, open the project, then <b>Settings → Environment Variables</b>, and add them as <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.</li>
            <li>Redeploy, then reload this page.</li>
          </ol>
        </div>
      </div>
    </main>
  );
}
