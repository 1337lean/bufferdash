const typeDetails: Record<string, { label: string; description: string }> = {
  not_found: {
    label: "Not found · 404",
    description: "A visitor or bot requested a URL that does not exist. This is not an IP lookup failure."
  }
};

export function EventType({ value }: { value: string }) {
  const detail = typeDetails[value];
  if (!detail) return <span>{value.replaceAll("_", " ")}</span>;
  return <span className="event-type" title={detail.description}>{detail.label}</span>;
}
