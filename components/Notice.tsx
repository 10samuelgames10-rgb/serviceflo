export function Notice({ ok }: { ok?: string | string[] }) {
  const msg = Array.isArray(ok) ? ok[0] : ok;
  if (!msg) return null;
  return <div className="notice" role="status">{msg}</div>;
}
