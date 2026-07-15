export function InfoCallout({ title, children, tone = "info" }: { title: string; children: React.ReactNode; tone?: "info" | "warning" }) {
  return <aside className={`info-callout ${tone}`}><strong>{title}</strong><div>{children}</div></aside>;
}
