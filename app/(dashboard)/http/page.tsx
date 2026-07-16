import { HttpStatusChart } from "@/components/Charts";
import { DataTable } from "@/components/DataTable";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { FilterBar } from "@/components/FilterBar";
import { InfoCallout } from "@/components/InfoCallout";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { StatusBadge } from "@/components/StatusBadge";
import { TopList } from "@/components/TopList";
import { TrafficToggle } from "@/components/TrafficToggle";
import { parseDateWindow, parsePage, parsePageSize, parseTraffic, type SearchParams } from "@/lib/filters";
import { compactDuration, numberFormat, shortDate } from "@/lib/format";
import { getHttpPage } from "@/lib/list-data";
import { maskIp } from "@/lib/ip";
import { isCloudflareIp } from "@/lib/cloudflare";
import { IpAddress } from "@/components/IpAddress";

const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default async function HttpPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const window = parseDateWindow(params); const page = parsePage(params.page); const pageSize = parsePageSize(params.pageSize);
  const traffic = parseTraffic(params.traffic, "all");
  const statusValue = Number(one(params.status));
  const status = Number.isInteger(statusValue) && statusValue >= 100 && statusValue <= 599 ? statusValue : undefined;
  const statusCandidate = one(params.statusClass);
  const statusClass = ["2xx", "3xx", "4xx", "5xx"].includes(statusCandidate || "") ? statusCandidate : undefined;
  const filters = { host: one(params.host), method: one(params.method)?.toUpperCase(), statusClass, status, path: one(params.path) };
  const data = await getHttpPage({ ...window, page, pageSize, traffic, ...filters });
  const requests = data.summary.requests;
  const rate4xx = requests ? data.summary.errors4xx / requests * 100 : 0; const rate5xx = requests ? data.summary.errors5xx / requests * 100 : 0;
  const byTime = new Map<string, { time: string; "2xx": number; "3xx": number; "4xx": number; "5xx": number }>();
  for (const row of data.timeline) { const key = new Date(row.bucket).toISOString(); const item = byTime.get(key) || { time: shortDate(new Date(row.bucket)), "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 }; if (row.class in item) item[row.class as "2xx"] = row.count; byTime.set(key, item); }
  const stale = !data.source || window.end.getTime() - data.source.lastSeenAt.getTime() > 150_000;
  return <>
    <PageHeader eyebrow="HTTP" title="Reverse-proxy diagnostics" description="First-party request aggregates and sanitized 4xx/5xx samples from Caddy." />
    <DateRangeFilter path="/http" params={params} selected={window.range} from={window.from} to={window.to} />
    <TrafficToggle selected={traffic} path="/http" params={params} />
    <FilterBar><form action="/http" className="filter-form">
      <input type="hidden" name="range" value={window.range} />{window.from && <input type="hidden" name="from" value={window.from} />}{window.to && <input type="hidden" name="to" value={window.to} />}<input type="hidden" name="traffic" value={traffic} />
      <label><span>Host</span><select name="host" defaultValue={filters.host || ""}><option value="">All hosts</option>{data.hosts.map((host) => <option key={host}>{host}</option>)}</select></label>
      <label><span>Method</span><select name="method" defaultValue={filters.method || ""}><option value="">All methods</option>{["GET","POST","PUT","PATCH","DELETE","HEAD","OPTIONS"].map((method) => <option key={method}>{method}</option>)}</select></label>
      <label><span>Status class</span><select name="statusClass" defaultValue={filters.statusClass || ""}><option value="">All statuses</option>{["2xx","3xx","4xx","5xx"].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><span>Exact status</span><input name="status" inputMode="numeric" defaultValue={filters.status} placeholder="502" /></label>
      <label className="filter-search"><span>Path contains</span><input name="path" defaultValue={filters.path} placeholder="/api/…" /></label>
      <label><span>Rows</span><select name="pageSize" defaultValue={pageSize}>{[25,50,100].map((value) => <option key={value}>{value}</option>)}</select></label>
      <button className="primary-button" type="submit">Apply filters</button>
    </form></FilterBar>
    <InfoCallout title={stale ? "Collector stale" : "Collector healthy"} tone={stale ? "warning" : "info"}>{data.source ? <>Last Caddy batch {shortDate(data.source.lastSeenAt)}{data.source.hostname ? ` from ${data.source.hostname}` : ""}.</> : "No Caddy request batch has been received."} Cloudflare edge-only errors that never reach the VPS are outside this view.</InfoCallout>
    <section className="metrics-grid">
      <MetricCard label="Requests" value={numberFormat(requests)} detail="Requests reaching the VPS" />
      <MetricCard label="4xx" value={numberFormat(data.summary.errors4xx)} detail={`${rate4xx.toFixed(1)}% of requests`} tone="orange" />
      <MetricCard label="5xx" value={numberFormat(data.summary.errors5xx)} detail={`${rate5xx.toFixed(1)}% of requests`} tone="red" />
      <MetricCard label="Average duration" value={compactDuration(data.summary.averageDuration)} detail={`Max ${compactDuration(data.summary.maximumDuration)}`} tone="green" />
    </section>
    <section className="panel span-full"><div className="panel-header"><h2>Status timeline</h2><span>2xx / 3xx / 4xx / 5xx</span></div><HttpStatusChart data={[...byTime.values()]} /></section>
    <section className="dashboard-grid"><TopList title="Top failing paths" rows={data.paths} /><TopList title="Status codes" rows={data.statuses} /></section>
    <section className="panel span-full"><div className="panel-header"><h2>Recent 4xx/5xx samples</h2><span>Sanitized; no queries, bodies, cookies, or authorization</span></div>
      <DataTable label="HTTP error samples"><thead><tr><th>Time</th><th>Status</th><th>Host</th><th>Method</th><th>Path</th><th>Duration</th><th>Visitor</th><th>Classification</th><th>Proxy error</th></tr></thead><tbody>
        {data.samples.map((sample) => <tr key={sample.id}><td>{shortDate(sample.occurredAt)}</td><td><span className={`status-badge ${sample.status >= 500 ? "error" : "warning"}`}>{sample.status >= 500 ? "Server error" : "Client error"} · {sample.status}</span></td><td>{sample.host}</td><td>{sample.method}</td><td className="wrap-cell" title={sample.path}>{sample.path}</td><td>{compactDuration(sample.durationMs)}</td><td><IpAddress address={maskIp(sample.ipAddress)} isCloudflare={isCloudflareIp(sample.ipAddress)} /></td><td><StatusBadge isBot={sample.isBot} botName={sample.botName} /></td><td className="wrap-cell">{sample.proxyError || "—"}</td></tr>)}
        {!data.samples.length && <tr><td colSpan={9}>No 4xx/5xx samples match these filters.</td></tr>}
      </tbody></DataTable><Pagination path="/http" params={params} page={page} pageSize={pageSize} total={data.sampleCount} /></section>
  </>;
}
