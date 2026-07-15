import Link from "next/link";
import { queryString, type SearchParams, type TrafficMode } from "@/lib/filters";

const modes: Array<[TrafficMode, string]> = [["human", "Human"], ["all", "All traffic"], ["bot", "Bots"]];

export function TrafficToggle({ selected, path, params, includeUnknown = false }: { selected: TrafficMode; path: string; params: SearchParams; includeUnknown?: boolean }) {
  const items = includeUnknown ? [...modes, ["unknown", "Unknown"] as [TrafficMode, string]] : modes;
  return (
    <nav className="traffic-toggle" aria-label="Traffic classification">
      {items.map(([value, label]) => (
        <Link key={value} className={selected === value ? "active" : undefined} aria-current={selected === value ? "page" : undefined}
          href={`${path}?${queryString(params, { traffic: value, page: 1 })}`}>{label}</Link>
      ))}
      <span className="filter-help">Human means not recognized as automated.</span>
    </nav>
  );
}
