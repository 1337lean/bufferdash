import { PageHeader } from "@/components/PageHeader";
import { TopList } from "@/components/TopList";
import { getSecurityEvents, getSuspiciousIps } from "@/lib/data";
import { shortDate } from "@/lib/format";
import { maskIp } from "@/lib/ip";

export default async function SecurityPage() {
  const [events, suspiciousIps] = await Promise.all([getSecurityEvents(), getSuspiciousIps()]);

  return (
    <>
      <PageHeader eyebrow="Security" title="Suspicious traffic and bot activity" description="Basic scanner, bot, and abuse detection from tracked requests." />
      <section className="dashboard-grid">
        <TopList title="Suspicious IP hashes" rows={suspiciousIps} />
        <section className="panel">
          <div className="panel-header"><h2>Detection coverage</h2></div>
          <div className="settings-list">
            <p>Known bots and crawlers</p>
            <p>WordPress and exposed-secret probes</p>
            <p>Empty or abnormal user agents</p>
            <p>Rate-limit enforcement on tracking</p>
          </div>
        </section>
      </section>
      <section className="panel span-full">
        <div className="panel-header"><h2>Security events</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Time</th><th>Type</th><th>IP</th><th>Source</th><th>Message</th></tr></thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{shortDate(event.createdAt)}</td>
                  <td>{event.type}</td>
                  <td>{maskIp(event.ipAddress)}</td>
                  <td>{event.source}</td>
                  <td>{event.message}</td>
                </tr>
              ))}
              {events.length === 0 && <tr><td colSpan={5}>No suspicious events recorded.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
