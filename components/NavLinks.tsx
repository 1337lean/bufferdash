"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ items }: { items: Array<[string, string]> }) {
  const pathname = usePathname();
  return <>{items.map(([label, href]) => {
    const active = pathname === href || (href === "/sites" && pathname.startsWith("/sites/"));
    return <Link href={href} key={href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>{label}</Link>;
  })}</>;
}
