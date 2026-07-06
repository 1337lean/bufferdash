import Link from "next/link";
import { logoutAction } from "@/app/actions";

const navItems = [
  ["Overview", "/dashboard"],
  ["Sites", "/sites"],
  ["Live", "/live"],
  ["Security", "/security"],
  ["Server", "/server"],
  ["Logs", "/logs"],
  ["Settings", "/settings"]
];

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="dash-shell">
      <aside className="sidebar">
        <Link className="brand" href="/dashboard" aria-label="BufferDash overview">
          <span className="brand-mark">&gt;_</span>
          Buffer<span>Dash</span>
        </Link>
        <nav className="sidebar-nav" aria-label="Dashboard navigation">
          {navItems.map(([label, href]) => (
            <Link href={href} key={href}>
              {label}
            </Link>
          ))}
        </nav>
        <form action={logoutAction} className="sidebar-footer">
          <button className="ghost-button" type="submit">Log out</button>
        </form>
      </aside>
      <main className="dash-main">{children}</main>
    </div>
  );
}
