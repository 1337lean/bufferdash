type MetricCardProps = {
  label: string;
  value: string;
  detail?: string;
  tone?: "violet" | "orange" | "green" | "red";
};

export function MetricCard({ label, value, detail, tone = "violet" }: MetricCardProps) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <p>{detail}</p>}
    </article>
  );
}
