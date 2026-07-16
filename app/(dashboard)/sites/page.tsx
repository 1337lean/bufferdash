import Link from "next/link";
import { createSiteAction, deleteSiteAction } from "@/app/actions";
import { CopyField } from "@/components/CopyField";
import { DisclosurePanel } from "@/components/DisclosurePanel";
import { CopySnippet } from "@/components/CopySnippet";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
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
            <input name="name" placeholder="Example site" required minLength={2} />
          </label>
          <label>
            <span>Domain</span>
            <input name="domain" placeholder="example.com" required minLength={3} />
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
                <p>{site.domain}</p>
              </div>
              <strong>{site._count.events ? "Tracking active" : "Awaiting first event"}</strong>
            </div>
            <div className="site-facts"><span>{numberFormat(site._count.events)} events</span><span>Last event {site.events[0] ? shortDate(site.events[0].createdAt) : "—"}</span></div>
            <CopyField label="Site key — safe to expose" value={site.publicKey} />
            <DisclosurePanel summary="Show full installation snippet"><CopySnippet value={trackingSnippet(site.publicKey)} /></DisclosurePanel>
            <form action={deleteSiteAction} className="row-actions">
              <input type="hidden" name="csrf" value={csrf} />
              <input type="hidden" name="siteId" value={site.id} />
              <Link className="secondary-button" href={`/sites/${site.id}`}>Open analytics</Link>
              <ConfirmSubmit message={`Delete ${site.name} and all of its analytics?`}>Delete</ConfirmSubmit>
            </form>
          </article>
        ))}
        {sites.length === 0 && <p className="empty-state">No sites yet. Add a domain, then paste the snippet into that site.</p>}
      </section>
    </>
  );
}
