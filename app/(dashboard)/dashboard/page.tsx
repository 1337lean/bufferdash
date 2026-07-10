import { TimelineChart, TopBarChart } from "@/components/Charts";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { TopList } from "@/components/TopList";
import { getDashboardData, getRecentEvents } from "@/lib/data";
import { compactDuration, numberFormat, shortDate } from "@/lib/format";
import { maskIp } from "@/lib/ip";

export default async function DashboardPage() {
  const [data, recentEvents] = await Promise.all([getDashboardData(), getRecentEvents(undefined, 10)]);
  const { overview } = data;

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Traffic, health, and security at a glance"
        description="A live command center for buffer.lol and any other site you add."
      />
      <section className="metrics-grid">
        <MetricCard label="Visitors today" value={numberFormat(overview.uniqueVisitorsToday)} detail="Unique visitors" />
        <MetricCard label="Page views today" value={numberFormat(overview.pageViewsToday)} detail="Tracked pageviews" tone="orange" />
        <MetricCard label="Live visitors" value={numberFormat(overview.liveVisitors)} detail="Active in five minutes" tone="green" />
        <MetricCard label="Avg session" value={compactDuration(overview.averageSessionDuration)} detail={`${numberFormat(overview.sessionsToday)} sessions`} />
      </section>

      <section className="panel span-full">
        <div className="panel-header">
          <h2>Requests over time</h2>
          <span>Last 24 hours</span>
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
        <TopList title="Tools used · 24h" rows={data.topTools} />
      </section>

      <section className="panel span-full">
        <div className="panel-header">
          <h2>Recent events</h2>
          <span>{numberFormat(overview.securityEvents)} traffic flags today</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Time</th><th>Site</th><th>Path</th><th>Visitor</th><th>Browser</th></tr>
            </thead>
            <tbody>
              {recentEvents.map((event) => (
                <tr key={event.id}>
                  <td>{shortDate(event.createdAt)}</td>
                  <td>{event.site.name}</td>
                  <td>{event.path || event.type}</td>
                  <td>{maskIp(event.ipAddress)}</td>
                  <td>{event.browser || "Unknown"}</td>
                </tr>
              ))}
              {recentEvents.length === 0 && <tr><td colSpan={5}>No events yet. Add a site and install the tracker.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
