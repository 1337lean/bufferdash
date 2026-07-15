import Link from "next/link";
import { queryString, type DateRangeKey, type SearchParams } from "@/lib/filters";

const presets = [["24h", "24h"], ["7d", "7d"], ["30d", "30d"], ["90d", "90d"]] as const;

export function DateRangeFilter({ path, params, selected, from, to }: { path: string; params: SearchParams; selected: DateRangeKey; from?: string; to?: string }) {
  return (
    <div className="date-filter">
      <nav aria-label="Date range">
        {presets.map(([value, label]) => <Link key={value} className={selected === value ? "active" : undefined}
          href={`${path}?${queryString(params, { range: value, from: undefined, to: undefined, page: 1 })}`}>{label}</Link>)}
      </nav>
      <form action={path} className="custom-dates">
        {Object.entries(params).map(([key, value]) => !["range", "from", "to", "page"].includes(key) && typeof value === "string"
          ? <input key={key} type="hidden" name={key} value={value} /> : null)}
        <input type="hidden" name="range" value="custom" />
        <label><span>From</span><input type="date" name="from" defaultValue={from} required /></label>
        <label><span>To</span><input type="date" name="to" defaultValue={to} required /></label>
        <button className="secondary-button" type="submit">Apply</button>
      </form>
    </div>
  );
}
