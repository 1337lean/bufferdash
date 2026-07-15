import Link from "next/link";
import { rangeOptions, type RangeKey } from "@/lib/range";
import { queryString, type SearchParams } from "@/lib/filters";

export function RangeSelector({ selected, basePath, params = {} }: { selected: RangeKey; basePath: string; params?: SearchParams }) {
  return (
    <nav className="range-selector" aria-label="Analytics time range">
      {rangeOptions.map((option) => (
        <Link
          aria-current={selected === option.key ? "page" : undefined}
          className={selected === option.key ? "active" : undefined}
          href={`${basePath}?${queryString(params, { range: option.key, page: 1 })}`}
          key={option.key}
        >
          {option.label}
        </Link>
      ))}
    </nav>
  );
}
