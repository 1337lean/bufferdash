export const rangeOptions = [
  { key: "24h", label: "24 hours", hours: 24 },
  { key: "7d", label: "7 days", hours: 24 * 7 },
  { key: "30d", label: "30 days", hours: 24 * 30 },
  { key: "90d", label: "90 days", hours: 24 * 90 }
] as const;

export type RangeKey = (typeof rangeOptions)[number]["key"];

export function parseRange(value: string | string[] | undefined): RangeKey {
  const candidate = Array.isArray(value) ? value[0] : value;
  return rangeOptions.some((option) => option.key === candidate) ? (candidate as RangeKey) : "24h";
}

export function rangeHours(range: RangeKey) {
  return rangeOptions.find((option) => option.key === range)?.hours || 24;
}

export function rangeLabel(range: RangeKey) {
  return rangeOptions.find((option) => option.key === range)?.label || "24 hours";
}

export function rangeStart(range: RangeKey, now = new Date()) {
  if (range === "24h") return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start;
}
