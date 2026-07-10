import { PageHeader } from "@/components/PageHeader";
import { AutoRefresh } from "@/components/AutoRefresh";
import { getLiveVisitors } from "@/lib/data";
import { shortDate } from "@/lib/format";
import { maskIp } from "@/lib/ip";

export default async function LivePage() {
  const visitors = await getLiveVisitors();

  return (
    <>
      <PageHeader eyebrow="Live" title="Visitors active now" description="People and sessions seen in the last five minutes." />
      <AutoRefresh seconds={10} />
      <section className="panel span-full">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Time</th><th>IP</th><th>Location</th><th>Site</th><th>Page</th><th>Referrer</th><th>Browser</th><th>OS</th><th>Device</th></tr></thead>
            <tbody>
              {visitors.map((event) => (
                <tr key={event.id}>
                  <td>{shortDate(event.createdAt)}</td>
                  <td>{maskIp(event.ipAddress)}</td>
                  <td>{[event.city, event.country].filter(Boolean).join(", ") || "Unknown"}</td>
                  <td>{event.site.name}</td>
                  <td>{event.path || event.type}</td>
                  <td>{event.referrerDomain || "Direct"}</td>
                  <td>{event.browser || "Unknown"}</td>
                  <td>{event.os || "Unknown"}</td>
                  <td>{event.device || "Unknown"}</td>
                </tr>
              ))}
              {visitors.length === 0 && <tr><td colSpan={9}>No active visitors right now.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
