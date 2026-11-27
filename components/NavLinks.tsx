"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ links }: { links: { href: string; label: string; badge?: number }[] }) {
  const path = usePathname();
  return (
    <nav className="nav">
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={path.startsWith(l.href) ? "on" : ""}>
          {l.label}
          {l.badge ? <span className="nav-badge">{l.badge}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
