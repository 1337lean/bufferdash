import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { getCsrfToken } from "@/lib/auth";
import { NavLinks } from "@/components/NavLinks";

const navItems = [
  ["Overview", "/dashboard"],
  ["Sites", "/sites"],
  ["Live", "/live"],
  ["HTTP", "/http"],
  ["Security", "/security"],
  ["Runtime", "/server"],
  ["Event stream", "/logs"],
  ["Settings", "/settings"]
];

export async function Shell({ children }: { children: React.ReactNode }) {
  const csrf = await getCsrfToken();

  return (
    <div className="dash-shell">
      <aside className="sidebar">
        <Link className="brand" href="/dashboard" aria-label="BufferDash overview">
          <span className="brand-mark">&gt;_</span>
          Buffer<span>Dash</span>
        </Link>
        <nav className="sidebar-nav" aria-label="Dashboard navigation">
          <NavLinks items={navItems as Array<[string, string]>} />
        </nav>
        <form action={logoutAction} className="sidebar-footer">
          <input type="hidden" name="csrf" value={csrf} />
          <button className="ghost-button" type="submit">Log out</button>
        </form>
      </aside>
      <main className="dash-main">{children}</main>
    </div>
  );
}
