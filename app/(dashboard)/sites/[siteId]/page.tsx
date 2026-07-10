import { notFound } from "next/navigation";
import { TimelineChart, TopBarChart } from "@/components/Charts";
import { CopySnippet } from "@/components/CopySnippet";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { RangeSelector } from "@/components/RangeSelector";
import { TopList } from "@/components/TopList";
import { getDashboardData, getRecentEvents, getSite } from "@/lib/data";
import { compactDuration, numberFormat, shortDate } from "@/lib/format";
import { maskIp } from "@/lib/ip";
import { trackingSnippet } from "@/lib/snippet";
import { parseRange, rangeLabel } from "@/lib/range";

export default async function SiteDetailPage({ params, searchParams }: { params: Promise<{ siteId: string }>; searchParams: Promise<{ range?: string }> }) {
  const { siteId } = await params;
  const range = parseRange((await searchParams).range);
  const site = await getSite(siteId);
  if (!site) notFound();

  const [data, recentEvents] = await Promise.all([getDashboardData(site.id, range), getRecentEvents(site.id, 30)]);
  const { overview } = data;

  return (
    <>
      <PageHeader eyebrow="Site analytics" title={site.name} description={`${site.domain} · key ${site.publicKey}`} />
      <RangeSelector selected={range} basePath={`/sites/${site.id}`} />
      <section className="panel span-full">
        <div className="panel-header"><h2>Tracking snippet</h2></div>
        <CopySnippet value={trackingSnippet(site.publicKey)} />
      </section>
      <section className="metrics-grid">
        <MetricCard label="Page views" value={numberFormat(overview.pageViews)} detail={rangeLabel(range)} tone="orange" />
        <MetricCard label="Unique visitors" value={numberFormat(overview.uniqueVisitors)} detail={rangeLabel(range)} />
        <MetricCard label="Sessions" value={numberFormat(overview.sessions)} detail={rangeLabel(range)} />
        <MetricCard label="Live visitors" value={numberFormat(overview.liveVisitors)} tone="green" />
        <MetricCard label="Avg session" value={compactDuration(overview.averageSessionDuration)} />
        <MetricCard label="Bounce rate" value={`${overview.bounceRate}%`} />
      </section>
      <section className="panel span-full">
        <div className="panel-header"><h2>{rangeLabel(range)}</h2></div>
        <TimelineChart data={overview.timeline} />
      </section>
      <section className="dashboard-grid">
        <TopList title="Top pages" rows={data.topPages} />
        <TopList title="Referrers" rows={data.referrers} />
        <TopList title="Browsers" rows={data.browsers} />
        <TopList title="Operating systems" rows={data.operatingSystems} />
        <TopList title="Countries" rows={data.countries} />
        <TopList title="Cities" rows={data.cities} />
        <TopList title="Tools used" rows={data.topTools} />
        <section className="panel">
          <div className="panel-header"><h2>Devices</h2></div>
          <TopBarChart data={data.devices} />
        </section>
      </section>
      <section className="panel span-full">
        <div className="panel-header"><h2>Visitor log</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Time</th><th>Path</th><th>Visitor</th><th>Location</th><th>Referrer</th><th>Browser</th><th>OS</th></tr></thead>
            <tbody>
              {recentEvents.map((event) => (
                <tr key={event.id}>
                  <td>{shortDate(event.createdAt)}</td>
                  <td>{event.path || event.type}</td>
                  <td>{maskIp(event.ipAddress)}</td>
                  <td>{[event.city, event.country].filter(Boolean).join(", ") || "Unknown"}</td>
                  <td>{event.referrerDomain || "Direct"}</td>
                  <td>{event.browser || "Unknown"}</td>
                  <td>{event.os || "Unknown"}</td>
                </tr>
              ))}
              {recentEvents.length === 0 && <tr><td colSpan={7}>No events for this site yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
