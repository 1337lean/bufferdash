import { PageHeader } from "@/components/PageHeader";
import { TopList } from "@/components/TopList";
import { getSecurityEvents, getSuspiciousIps } from "@/lib/data";
import { shortDate } from "@/lib/format";
import { maskIp } from "@/lib/ip";

export default async function SecurityPage() {
  const [events, suspiciousIps] = await Promise.all([getSecurityEvents(), getSuspiciousIps()]);

  return (
    <>
      <PageHeader eyebrow="Traffic quality" title="Bots and unusual tracked visits" description="Signals visible to the browser tracker. VPS, SSH, reverse-proxy, and requests that do not execute JavaScript are not included." />
      <section className="dashboard-grid">
        <TopList title="Suspicious IP hashes" rows={suspiciousIps} />
        <section className="panel">
          <div className="panel-header"><h2>Tracker coverage</h2></div>
          <div className="settings-list">
            <p>Known bots and crawlers</p>
            <p>Unusual paths reached by JavaScript-capable clients</p>
            <p>Empty or abnormal user agents</p>
            <p>Tracking endpoint rate-limit enforcement</p>
          </div>
        </section>
      </section>
      <section className="panel span-full">
        <div className="panel-header"><h2>Traffic flags</h2></div>
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
              {events.length === 0 && <tr><td colSpan={5}>No tracked traffic flags recorded.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
