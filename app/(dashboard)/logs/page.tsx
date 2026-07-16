import { PageHeader } from "@/components/PageHeader";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { TrafficToggle } from "@/components/TrafficToggle";
import { Pagination } from "@/components/Pagination";
import { FilterBar } from "@/components/FilterBar";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { EventType } from "@/components/EventType";
import { parseDateWindow, parsePage, parsePageSize, parseTraffic, type SearchParams } from "@/lib/filters";
import { getAppLogPage } from "@/lib/list-data";
import { shortDate } from "@/lib/format";

const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default async function LogsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const window = parseDateWindow(params); const page = parsePage(params.page); const pageSize = parsePageSize(params.pageSize);
  const traffic = parseTraffic(params.traffic, "all");
  const values = { kind: one(params.kind), type: one(params.type), source: one(params.source), siteId: one(params.siteId), q: one(params.q) };
  const data = await getAppLogPage({ ...window, page, pageSize, traffic, ...values });
  return <>
    <PageHeader eyebrow="Event stream" title="Application activity" description="A paginated database-level stream of tracking and security events. HTTP samples remain in HTTP diagnostics." />
    <DateRangeFilter path="/logs" params={params} selected={window.range} from={window.from} to={window.to} />
    <TrafficToggle selected={traffic} path="/logs" params={params} includeUnknown />
    <FilterBar><form action="/logs" className="filter-form">
      <input type="hidden" name="range" value={window.range} />{window.from && <input type="hidden" name="from" value={window.from} />}{window.to && <input type="hidden" name="to" value={window.to} />}<input type="hidden" name="traffic" value={traffic} />
      <label><span>Kind</span><select name="kind" defaultValue={values.kind || ""}><option value="">Tracking + security</option><option value="tracking">Tracking</option><option value="security">Security</option></select></label>
      <label><span>Site</span><select name="siteId" defaultValue={values.siteId || ""}><option value="">All sites</option>{data.sites.map((site) => <option value={site.id} key={site.id}>{site.name}</option>)}</select></label>
      <label><span>Source</span><input name="source" defaultValue={values.source} /></label><label><span>Type</span><input name="type" defaultValue={values.type} /></label>
      <label className="filter-search"><span>Text search</span><input name="q" defaultValue={values.q} placeholder="Path or message…" /></label>
      <label><span>Rows</span><select name="pageSize" defaultValue={pageSize}>{[25,50,100].map((value) => <option key={value}>{value}</option>)}</select></label>
      <button className="primary-button" type="submit">Apply filters</button>
    </form></FilterBar>
    <section className="panel span-full"><DataTable label="Event stream"><thead><tr><th>Time</th><th>Kind</th><th>Source</th><th>Type</th><th>Classification</th><th>Message</th></tr></thead><tbody>
      {data.rows.map((row) => <tr key={`${row.kind}:${row.id}`}><td>{shortDate(row.createdAt)}</td><td>{row.kind}</td><td>{row.source}</td><td><EventType value={row.type} /></td><td><StatusBadge isBot={row.isBot} /></td><td className="wrap-cell" title={row.message}>{row.message}</td></tr>)}
      {!data.rows.length && <tr><td colSpan={6}>No events match these filters.</td></tr>}
    </tbody></DataTable><Pagination path="/logs" params={params} page={page} pageSize={pageSize} total={data.total} /></section>
  </>;
}
