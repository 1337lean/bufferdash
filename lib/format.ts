export function numberFormat(value: number | bigint | null | undefined) {
  return Number(value || 0).toLocaleString("en-US");
}

export function percent(value: number | null | undefined) {
  return `${Math.round(value || 0)}%`;
}

export function compactDuration(ms: number | null | undefined) {
  if (!ms) return "0s";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}m ${rest}s`;
}

export function shortDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}
