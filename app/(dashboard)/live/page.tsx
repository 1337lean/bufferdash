import { PageHeader } from "@/components/PageHeader";
import { AutoRefresh } from "@/components/AutoRefresh";
import { getLiveVisitors } from "@/lib/data";
import { shortDate } from "@/lib/format";
import { maskIp } from "@/lib/ip";
import { parseTraffic, type SearchParams } from "@/lib/filters";
import { TrafficToggle } from "@/components/TrafficToggle";
import { StatusBadge } from "@/components/StatusBadge";
import { isCloudflareIp } from "@/lib/cloudflare";
import { IpAddress } from "@/components/IpAddress";

export default async function LivePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const traffic = parseTraffic(params.traffic, "human");
  const visitors = await getLiveVisitors(undefined, traffic);

  return (
    <>
      <PageHeader eyebrow="Live" title="Visitors active now" description="Recognized human, automated, and unknown sessions seen in the last five minutes." />
      <TrafficToggle selected={traffic} path="/live" params={params} />
      <AutoRefresh seconds={10} />
      <section className="panel span-full">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Time</th><th>IP</th><th>Class</th><th>Location</th><th>Site</th><th>Page</th><th>Referrer</th><th>Browser</th><th>OS</th><th>Device</th></tr></thead>
            <tbody>
              {visitors.map((event) => (
                <tr key={event.id}>
                  <td>{shortDate(event.createdAt)}</td>
                  <td><IpAddress address={maskIp(event.ipAddress)} isCloudflare={isCloudflareIp(event.ipAddress)} /></td>
                  <td><StatusBadge isBot={event.isBot} botName={event.botName} asn={event.asn} isp={event.isp} /></td>
                  <td>{[event.city, event.country].filter(Boolean).join(", ") || "Unknown"}</td>
                  <td>{event.site.name}</td>
                  <td>{event.path || event.type}</td>
                  <td>{event.referrerDomain || "Direct"}</td>
                  <td>{event.browser || "Unknown"}</td>
                  <td>{event.os || "Unknown"}</td>
                  <td>{event.device || "Unknown"}</td>
                </tr>
              ))}
              {visitors.length === 0 && <tr><td colSpan={10}>No active visitors match this traffic view.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
