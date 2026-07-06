import Link from "next/link";
import { createSiteAction, deleteSiteAction } from "@/app/actions";
import { CopySnippet } from "@/components/CopySnippet";
import { PageHeader } from "@/components/PageHeader";
import { ActionForm } from "@/components/StateMessage";
import { getCsrfToken } from "@/lib/auth";
import { getSites } from "@/lib/data";
import { numberFormat, shortDate } from "@/lib/format";
import { trackingSnippet } from "@/lib/snippet";

export default async function SitesPage() {
  const [sites, csrf] = await Promise.all([getSites(), getCsrfToken()]);

  return (
    <>
      <PageHeader eyebrow="Sites" title="Tracked websites" description="Create a site key, copy the snippet, and start collecting events." />

      <section className="panel span-full">
        <div className="panel-header">
          <h2>Add site</h2>
        </div>
        <ActionForm action={createSiteAction} className="form-grid">
          <input type="hidden" name="csrf" value={csrf} />
          <label>
            <span>Site name</span>
            <input name="name" placeholder="buffer.lol" required minLength={2} />
          </label>
          <label>
            <span>Domain</span>
            <input name="domain" placeholder="buffer.lol" required minLength={3} />
          </label>
          <button className="primary-button" type="submit">Create site</button>
        </ActionForm>
      </section>

      <section className="site-list">
        {sites.map((site) => (
          <article className="panel site-card" key={site.id}>
            <div className="site-card-top">
              <div>
                <h2><Link href={`/sites/${site.id}`}>{site.name}</Link></h2>
                <p>{site.domain} · created {shortDate(site.createdAt)}</p>
              </div>
              <strong>{numberFormat(site._count.events)} events</strong>
            </div>
            <CopySnippet value={trackingSnippet(site.publicKey)} />
            <form action={deleteSiteAction} className="row-actions">
              <input type="hidden" name="csrf" value={csrf} />
              <input type="hidden" name="siteId" value={site.id} />
              <Link className="secondary-button" href={`/sites/${site.id}`}>Open analytics</Link>
              <button className="danger-button" type="submit">Delete</button>
            </form>
          </article>
        ))}
        {sites.length === 0 && <p className="empty-state">No sites yet. Add buffer.lol first, then paste the snippet into the site.</p>}
      </section>
    </>
  );
}
