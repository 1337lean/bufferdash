import { env } from "@/lib/env";
import { parseRange, rangeStart, type RangeKey } from "@/lib/range";

export type SearchParams = Record<string, string | string[] | undefined>;
export type TrafficMode = "human" | "all" | "bot" | "unknown";
export type DateRangeKey = RangeKey | "custom";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseTraffic(value: string | string[] | undefined, fallback: TrafficMode = "human"): TrafficMode {
  const candidate = first(value);
  return ["human", "all", "bot", "unknown"].includes(candidate || "") ? candidate as TrafficMode : fallback;
}

export function parsePage(value: string | string[] | undefined) {
  const page = Number(first(value));
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function parsePageSize(value: string | string[] | undefined) {
  const size = Number(first(value));
  return [25, 50, 100].includes(size) ? size : 25;
}

export function parseDateWindow(params: SearchParams, now = new Date()) {
  const requested = first(params.range);
  if (requested === "custom") {
    const from = parseCalendarDate(first(params.from));
    const toDay = parseCalendarDate(first(params.to));
    if (from && toDay) {
      const to = new Date(toDay);
      to.setDate(to.getDate() + 1);
      const retentionStart = new Date(now);
      retentionStart.setHours(0, 0, 0, 0);
      retentionStart.setDate(retentionStart.getDate() - (env.dataRetentionDays - 1));
      const tomorrow = new Date(now);
      tomorrow.setHours(0, 0, 0, 0);
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (from < to && from >= retentionStart && to <= tomorrow) {
        return { range: "custom" as const, start: from, end: to, from: first(params.from)!, to: first(params.to)! };
      }
    }
  }
  const range = parseRange(requested);
  return { range, start: rangeStart(range, now), end: now, from: undefined, to: undefined };
}

function parseCalendarDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

export function queryString(params: SearchParams, updates: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const item = first(value);
    if (item) query.set(key, item);
  }
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === "") query.delete(key);
    else query.set(key, String(value));
  }
  return query.toString();
}

export function trafficWhere(traffic: TrafficMode) {
  if (traffic === "bot") return { isBot: true } as const;
  if (traffic === "human") return { isBot: false } as const;
  if (traffic === "unknown") return { isBot: null } as const;
  return {};
}
