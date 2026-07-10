import Link from "next/link";
import { rangeOptions, type RangeKey } from "@/lib/range";

export function RangeSelector({ selected, basePath }: { selected: RangeKey; basePath: string }) {
  return (
    <nav className="range-selector" aria-label="Analytics time range">
      {rangeOptions.map((option) => (
        <Link
          aria-current={selected === option.key ? "page" : undefined}
          className={selected === option.key ? "active" : undefined}
          href={`${basePath}?range=${option.key}`}
          key={option.key}
        >
          {option.label}
        </Link>
      ))}
    </nav>
  );
}
