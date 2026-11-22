"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="nav">
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={path.startsWith(l.href) ? "on" : ""}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
