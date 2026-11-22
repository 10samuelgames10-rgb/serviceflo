export function TopBar({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <header className="top">
      <div>
        <h1>{title}</h1>
        {sub ? <div className="sub">{sub}</div> : null}
      </div>
      <div className="grow" />
      {children}
    </header>
  );
}
