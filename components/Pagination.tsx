import Link from "next/link";
import { queryString, type SearchParams } from "@/lib/filters";

export function Pagination({ path, params, page, pageSize, total }: { path: string; params: SearchParams; page: number; pageSize: number; total: number }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = Math.max(1, Math.min(page - 2, pages - 4));
  const numbers = Array.from({ length: Math.min(5, pages) }, (_, index) => first + index);
  return (
    <nav className="pagination" aria-label="Pagination">
      <Link aria-disabled={page <= 1} href={`${path}?${queryString(params, { page: Math.max(1, page - 1) })}`}>Previous</Link>
      {numbers.map((number) => <Link key={number} className={number === page ? "active" : undefined} aria-current={number === page ? "page" : undefined}
        href={`${path}?${queryString(params, { page: number })}`}>{number}</Link>)}
      <Link aria-disabled={page >= pages} href={`${path}?${queryString(params, { page: Math.min(pages, page + 1) })}`}>Next</Link>
      <span>{total.toLocaleString()} rows</span>
    </nav>
  );
}
