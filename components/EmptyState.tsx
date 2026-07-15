export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="empty-state-box"><strong>{title}</strong>{children && <p>{children}</p>}</div>;
}
