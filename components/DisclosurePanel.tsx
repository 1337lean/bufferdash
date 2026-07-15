export function DisclosurePanel({ summary, children, open = false }: { summary: string; children: React.ReactNode; open?: boolean }) {
  return <details className="disclosure" open={open}><summary>{summary}</summary><div>{children}</div></details>;
}
