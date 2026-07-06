import type { TopRow } from "@/lib/data";
import { numberFormat } from "@/lib/format";

export function TopList({ title, rows }: { title: string; rows: TopRow[] }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{title}</h2>
      </div>
      <div className="rank-list">
        {rows.length === 0 ? (
          <p className="empty-state">No data yet.</p>
        ) : (
          rows.map((row) => (
            <div className="rank-row" key={row.label}>
              <span>{row.label}</span>
              <strong>{numberFormat(row.value)}</strong>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
