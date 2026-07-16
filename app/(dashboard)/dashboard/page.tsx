import { TimelineChart, TopBarChart } from "@/components/Charts";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { RangeSelector } from "@/components/RangeSelector";
import { TopList } from "@/components/TopList";
import { getDashboardData, getRecentEvents } from "@/lib/data";
import { compactDuration, numberFormat, shortDate } from "@/lib/format";
import { maskIp } from "@/lib/ip";
import { parseRange, rangeLabel } from "@/lib/range";
import { parseTraffic, type SearchParams } from "@/lib/filters";
import { TrafficToggle } from "@/components/TrafficToggle";
import { StatusBadge } from "@/components/StatusBadge";
import { InfoCallout } from "@/components/InfoCallout";
import { env } from "@/lib/env";
import { isCloudflareIp } from "@/lib/cloudflare";
import { IpAddress } from "@/components/IpAddress";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const range = parseRange(params.range);
  const traffic = parseTraffic(params.traffic, "human");
  const [data, recentEvents] = await Promise.all([getDashboardData(undefined, range, traffic), getRecentEvents(undefined, 10, traffic)]);
  const { overview } = data;
  const cloudflareNetworks = recentEvents.filter((event) => event.asn?.toUpperCase() === "AS13335" || event.isp?.toLowerCase().includes("cloudflare")).length;
  const proxyWarning = recentEvents.length >= 5 && cloudflareNetworks / recentEvents.length > 0.5;

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Traffic, health, and security at a glance"
        description="A live command center for every site you add."
      />
      <TrafficToggle selected={traffic} path="/dashboard" params={params} />
      <RangeSelector selected={range} basePath="/dashboard" params={params} />
      {proxyWarning && <InfoCallout title="Check trusted-proxy configuration" tone="warning">Most recent client networks resolve to Cloudflare. This can indicate that the origin is storing the proxy address instead of Caddy&apos;s parsed client IP.</InfoCallout>}
      <section className="metrics-grid">
        <MetricCard label="Unique visitors" value={numberFormat(overview.uniqueVisitors)} detail={rangeLabel(range)} />
        <MetricCard label="Page views" value={numberFormat(overview.pageViews)} detail={rangeLabel(range)} tone="orange" />
        <MetricCard label="Live visitors" value={numberFormat(overview.liveVisitors)} detail="Active in five minutes" tone="green" />
        <MetricCard label="Avg session" value={compactDuration(overview.averageSessionDuration)} detail={`${numberFormat(overview.sessions)} sessions`} />
        <MetricCard label="Bounce rate" value={`${overview.bounceRate}%`} detail="Single-page sessions" />
      </section>

      <section className="panel span-full">
        <div className="panel-header">
          <h2>Requests over time</h2>
          <span>{rangeLabel(range)}</span>
        </div>
        <TimelineChart data={overview.timeline} />
      </section>

      <section className="dashboard-grid">
        <TopList title="Top pages" rows={data.topPages} />
        <TopList title="Referrers" rows={data.referrers} />
        <section className="panel">
          <div className="panel-header">
            <h2>Browsers</h2>
          </div>
          <TopBarChart data={data.browsers} />
        </section>
        <TopList title="Operating systems" rows={data.operatingSystems} />
        <TopList title="Devices" rows={data.devices} />
        <TopList title="Countries" rows={data.countries} />
        {data.cities.length ? <TopList title="Cities" rows={data.cities} /> : <section className="panel"><div className="panel-header"><h2>Cities</h2></div>
          <InfoCallout title={overview.pageViews === 0 ? "No traffic yet" : !env.ipinfoToken ? "City data not received" : env.ipinfoTier === "lite" ? "City data not received" : "No city data returned"}>
            {overview.pageViews === 0 ? "City data will appear with new page views." : !env.ipinfoToken ? "Enable Cloudflare’s Add visitor location headers managed transform, or configure IPinfo Core." : env.ipinfoTier === "lite" ? "Enable Cloudflare’s location headers or use IPinfo Core; IPinfo Lite supplies only country and ASN." : "Core is configured, but recent events did not include a city."}
          </InfoCallout></section>}
        <TopList title="Tools used" rows={data.topTools} />
      </section>

      <section className="panel span-full">
        <div className="panel-header">
          <h2>Recent events</h2>
          <span>{numberFormat(overview.securityEvents)} traffic flags · {rangeLabel(range)}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Time</th><th>Site</th><th>Path</th><th>Visitor</th><th>Classification</th><th>Browser</th></tr>
            </thead>
            <tbody>
              {recentEvents.map((event) => (
                <tr key={event.id}>
                  <td>{shortDate(event.createdAt)}</td>
                  <td>{event.site.name}</td>
                  <td>{event.path || event.type}</td>
                  <td><IpAddress address={maskIp(event.ipAddress)} isCloudflare={isCloudflareIp(event.ipAddress)} /></td>
                  <td><StatusBadge isBot={event.isBot} botName={event.botName} asn={event.asn} isp={event.isp} /></td>
                  <td>{event.browser || "Unknown"}</td>
                </tr>
              ))}
              {recentEvents.length === 0 && <tr><td colSpan={6}>No events match this traffic view.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
