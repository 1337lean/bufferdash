export function numberFormat(value: number | bigint | null | undefined) {
  return Number(value || 0).toLocaleString("en-US");
}

export function percent(value: number | null | undefined) {
  return `${Math.round(value || 0)}%`;
}

export function compactDuration(ms: number | null | undefined) {
  if (!ms) return "0s";
  if (ms > 0 && ms < 1000) return "<1s";
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

export function bytes(value: number | bigint | null | undefined) {
  const amount = Number(value || 0);
  if (amount < 1024) return `${amount} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let result = amount / 1024;
  let index = 0;
  while (result >= 1024 && index < units.length - 1) { result /= 1024; index += 1; }
  return `${result.toFixed(result >= 10 ? 0 : 1)} ${units[index]}`;
}
