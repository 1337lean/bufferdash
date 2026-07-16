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
import { isCloudflareIp } from "@/lib/cloudflare";
import { IpAddress } from "@/components/IpAddress";
import { trackingSnippet } from "@/lib/snippet";
import { parseRange, rangeLabel } from "@/lib/range";
import { parseTraffic, type SearchParams } from "@/lib/filters";
import { TrafficToggle } from "@/components/TrafficToggle";
import { CopyField } from "@/components/CopyField";
import { DisclosurePanel } from "@/components/DisclosurePanel";
import { StatusBadge } from "@/components/StatusBadge";
import { InfoCallout } from "@/components/InfoCallout";
import { env } from "@/lib/env";

export default async function SiteDetailPage({ params, searchParams }: { params: Promise<{ siteId: string }>; searchParams: Promise<SearchParams> }) {
  const { siteId } = await params;
  const query = await searchParams;
  const range = parseRange(query.range);
  const traffic = parseTraffic(query.traffic, "human");
  const site = await getSite(siteId);
  if (!site) notFound();

  const [data, recentEvents] = await Promise.all([getDashboardData(site.id, range, traffic), getRecentEvents(site.id, 30, traffic)]);
  const { overview } = data;

  return (
    <>
      <PageHeader eyebrow="Site analytics" title={site.name} description={site.domain} />
      {query.created === "1" && <InfoCallout title="Site created">Install the tracker below. This page will switch from waiting to active after the first event arrives.</InfoCallout>}
      <TrafficToggle selected={traffic} path={`/sites/${site.id}`} params={query} />
      <RangeSelector selected={range} basePath={`/sites/${site.id}`} params={query} />
      <section className="panel span-full">
        <div className="panel-header"><h2>{site._count.events ? "Tracking active" : "Waiting for first event"}</h2><span>Installation</span></div>
        <ol className="install-steps"><li>Use the site key when an existing loader asks for `BUFFERDASH_SITE_ID`.</li><li>Otherwise paste the full script before the closing body tag.</li><li>Load the site once and refresh this page.</li></ol>
        <CopyField label="Site key — safe to expose" value={site.publicKey} />
        <DisclosurePanel summary="Show full script snippet" open={query.created === "1"}><CopySnippet value={trackingSnippet(site.publicKey)} /></DisclosurePanel>
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
        {data.cities.length ? <TopList title="Cities" rows={data.cities} /> : <section className="panel"><div className="panel-header"><h2>Cities</h2></div><InfoCallout title={!site._count.events ? "No traffic yet" : !env.ipinfoToken || env.ipinfoTier === "lite" ? "City data not received" : "No city data returned"}>Enable Cloudflare&apos;s Add visitor location headers managed transform or use IPinfo Core. City data applies prospectively to new events.</InfoCallout></section>}
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
            <thead><tr><th>Time</th><th>Path</th><th>Visitor</th><th>Classification</th><th>Location</th><th>Referrer</th><th>Browser</th><th>OS</th></tr></thead>
            <tbody>
              {recentEvents.map((event) => (
                <tr key={event.id}>
                  <td>{shortDate(event.createdAt)}</td>
                  <td>{event.path || event.type}</td>
                  <td><IpAddress address={maskIp(event.ipAddress)} isCloudflare={isCloudflareIp(event.ipAddress)} /></td>
                  <td><StatusBadge isBot={event.isBot} botName={event.botName} asn={event.asn} isp={event.isp} /></td>
                  <td>{[event.city, event.country].filter(Boolean).join(", ") || "Unknown"}</td>
                  <td>{event.referrerDomain || "Direct"}</td>
                  <td>{event.browser || "Unknown"}</td>
                  <td>{event.os || "Unknown"}</td>
                </tr>
              ))}
              {recentEvents.length === 0 && <tr><td colSpan={8}>No events match this traffic view.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
