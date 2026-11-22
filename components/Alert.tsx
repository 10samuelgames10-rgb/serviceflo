export function Alert({ error }: { error?: string | string[] }) {
  const msg = Array.isArray(error) ? error[0] : error;
  if (!msg) return null;
  return <div className="alert" role="alert">{msg}</div>;
}
