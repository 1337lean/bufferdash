import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { TrafficToggle } from "@/components/TrafficToggle";
import { Pagination } from "@/components/Pagination";
import { FilterBar } from "@/components/FilterBar";
import { DataTable } from "@/components/DataTable";
import { InfoCallout } from "@/components/InfoCallout";
import { StatusBadge } from "@/components/StatusBadge";
import { EventType } from "@/components/EventType";
import { IpAddress } from "@/components/IpAddress";
import { isCloudflareIp } from "@/lib/cloudflare";
import { parseDateWindow, parsePage, parsePageSize, parseTraffic, queryString, type SearchParams } from "@/lib/filters";
import { getSecurityPage } from "@/lib/list-data";
import { shortDate } from "@/lib/format";
import { maskIp } from "@/lib/ip";

const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default async function SecurityPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const window = parseDateWindow(params);
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.pageSize);
  const traffic = parseTraffic(params.traffic, "all");
  const filters = { type: one(params.type), source: one(params.source), ipHash: one(params.ipHash), q: one(params.q) };
  const data = await getSecurityPage({ ...window, page, pageSize, traffic, ...filters });
  return <>
    <PageHeader eyebrow="Security" title="Traffic and host security signals" description="Signals help investigation; they are not proof of malicious intent." />
    <DateRangeFilter path="/security" params={params} selected={window.range} from={window.from} to={window.to} />
    <TrafficToggle selected={traffic} path="/security" params={params} includeUnknown />
    <FilterBar><form action="/security" className="filter-form">
      <input type="hidden" name="range" value={window.range} />{window.from && <input type="hidden" name="from" value={window.from} />}{window.to && <input type="hidden" name="to" value={window.to} />}<input type="hidden" name="traffic" value={traffic} />
      <label><span>Type</span><select name="type" defaultValue={filters.type || ""}><option value="">All types</option>{data.types.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><span>Source</span><select name="source" defaultValue={filters.source || ""}><option value="">All sources</option>{data.sources.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="filter-search"><span>Search message or masked IP</span><input name="q" defaultValue={filters.q} placeholder="Search…" /></label>
      <label><span>Rows</span><select name="pageSize" defaultValue={pageSize}>{[25,50,100].map((value) => <option key={value}>{value}</option>)}</select></label>
      <button className="primary-button" type="submit">Apply filters</button>
    </form></FilterBar>
    {data.types.includes("not_found") && <InfoCallout title="What “Not found · 404” means">A visitor or automated scanner requested a URL that does not exist. The requested path is shown in the Message column. This event type is unrelated to IP or location lookup failures.</InfoCallout>}
    {filters.ipHash && <InfoCallout title="Filtered fingerprint">Showing the complete privacy-preserving hash <code>{filters.ipHash}</code>. <Link href={`/security?${queryString(params, { ipHash: undefined, page: 1 })}`}>Clear</Link></InfoCallout>}
    <section className="dashboard-grid">
      <section className="panel"><div className="panel-header"><h2>Repeat flagged visitors</h2></div>
        <p className="muted">A privacy-preserving fingerprint used to recognize repeated activity from the same IP without displaying the full address. A high count means repeated security signals, not proof of malicious intent.</p>
        <div className="rank-list">{data.repeatVisitors.map((row) => <Link className="rank-row" key={row.hash} href={`/security?${queryString(params, { ipHash: row.hash, page: 1 })}`} title={row.hash}><span>{row.hash.slice(0, 12)}…</span><strong>{row.value}</strong></Link>)}{!data.repeatVisitors.length && <p className="empty-state">No repeat fingerprints in this window.</p>}</div>
      </section>
      <section className="panel"><div className="panel-header"><h2>Signal counts</h2></div><div className="rank-list">{data.signals.map((row) => <div className="rank-row" key={row.label}><span>{row.label}</span><strong>{row.value}</strong></div>)}</div></section>
    </section>
    <section className="panel span-full"><div className="panel-header"><h2>Security events</h2><span>Stable newest-first ordering</span></div>
      <DataTable label="Security events"><thead><tr><th>Time</th><th>Type</th><th>IP</th><th>Source</th><th>Classification</th><th>Message</th></tr></thead><tbody>
        {data.events.map((event) => <tr key={event.id}><td>{shortDate(event.createdAt)}</td><td><EventType value={event.type} /></td><td><IpAddress address={maskIp(event.ipAddress)} isCloudflare={isCloudflareIp(event.ipAddress)} /></td><td>{event.source}</td><td><StatusBadge isBot={event.isBot} botName={event.botName} /></td><td className="wrap-cell" title={event.message}>{event.message}</td></tr>)}
        {!data.events.length && <tr><td colSpan={6}>No security events match these filters.</td></tr>}
      </tbody></DataTable><Pagination path="/security" params={params} page={page} pageSize={pageSize} total={data.total} />
    </section>
  </>;
}
