import { notFound } from "next/navigation";
import { TimelineChart, TopBarChart } from "@/components/Charts";
import { CopySnippet } from "@/components/CopySnippet";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { TopList } from "@/components/TopList";
import { getDashboardData, getRecentEvents, getSite } from "@/lib/data";
import { compactDuration, numberFormat, shortDate } from "@/lib/format";
import { maskIp } from "@/lib/ip";
import { trackingSnippet } from "@/lib/snippet";

export default async function SiteDetailPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const site = await getSite(siteId);
  if (!site) notFound();

  const [data, recentEvents] = await Promise.all([getDashboardData(site.id), getRecentEvents(site.id, 30)]);
  const { overview } = data;

  return (
    <>
      <PageHeader eyebrow="Site analytics" title={site.name} description={`${site.domain} · key ${site.publicKey}`} />
      <section className="panel span-full">
        <div className="panel-header"><h2>Tracking snippet</h2></div>
        <CopySnippet value={trackingSnippet(site.publicKey)} />
      </section>
      <section className="metrics-grid">
        <MetricCard label="Page views today" value={numberFormat(overview.pageViewsToday)} tone="orange" />
        <MetricCard label="Unique visitors" value={numberFormat(overview.uniqueVisitorsToday)} />
        <MetricCard label="Live visitors" value={numberFormat(overview.liveVisitors)} tone="green" />
        <MetricCard label="Avg session" value={compactDuration(overview.averageSessionDuration)} />
      </section>
      <section className="panel span-full">
        <div className="panel-header"><h2>Last 24 hours</h2></div>
        <TimelineChart data={overview.timeline} />
      </section>
      <section className="dashboard-grid">
        <TopList title="Top pages" rows={data.topPages} />
        <TopList title="Referrers" rows={data.referrers} />
        <TopList title="Tools used · 24h" rows={data.topTools} />
        <section className="panel">
          <div className="panel-header"><h2>Devices</h2></div>
          <TopBarChart data={data.devices} />
        </section>
      </section>
      <section className="panel span-full">
        <div className="panel-header"><h2>Visitor log</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Time</th><th>Path</th><th>Visitor</th><th>Referrer</th><th>Browser</th><th>OS</th></tr></thead>
            <tbody>
              {recentEvents.map((event) => (
                <tr key={event.id}>
                  <td>{shortDate(event.createdAt)}</td>
                  <td>{event.path || event.type}</td>
                  <td>{maskIp(event.ipAddress)}</td>
                  <td>{event.referrerDomain || "Direct"}</td>
                  <td>{event.browser || "Unknown"}</td>
                  <td>{event.os || "Unknown"}</td>
                </tr>
              ))}
              {recentEvents.length === 0 && <tr><td colSpan={6}>No events for this site yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
