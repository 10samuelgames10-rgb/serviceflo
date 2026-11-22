import { Alert } from "@/components/Alert";
import { signIn, signUp } from "../actions";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; sent?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="auth">
      <form className="panel">
        <div className="panel-b" style={{ display: "grid", gap: 14 }}>
          <div className="brand"><span className="brand-mark">S</span>ServiceFlo</div>
          <h2 style={{ fontSize: 20 }}>Sign in</h2>
          <Alert error={sp.error} />
          {sp.sent ? <div className="notice">Check your email for a link to confirm your account, then sign in here.</div> : null}
          <div className="field"><label htmlFor="email">Email</label><input className="in" id="email" name="email" type="email" autoComplete="email" required /></div>
          <div className="field"><label htmlFor="password">Password</label><input className="in" id="password" name="password" type="password" autoComplete="current-password" required minLength={8} /></div>
          <button className="btn pri" formAction={signIn} style={{ justifyContent: "center", padding: 10 }}>Sign in</button>
          <button className="btn" formAction={signUp} style={{ justifyContent: "center", padding: 10 }}>Create an account</button>
          <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>Employees: ask your manager to add you to the team, then create an account with the same email.</p>
        </div>
      </form>
    </main>
  );
}
