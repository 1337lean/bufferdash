import "server-only";

import crypto from "node:crypto";
import { env } from "@/lib/env";

export function ingestionAuthorized(header: string | null) {
  const supplied = header?.startsWith("Bearer ") ? header.slice(7) : "";
  const expected = env.ingestionSecret;
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  return Boolean(supplied && expected && left.length === right.length && crypto.timingSafeEqual(left, right));
}

export function sanitizeRequestPath(value: string) {
  const raw = value.trim();
  if (!raw) return "/";
  try {
    const url = new URL(raw, "http://bufferdash.invalid");
    return (url.pathname || "/").slice(0, 1000);
  } catch {
    return (raw.split(/[?#]/, 1)[0] || "/").slice(0, 1000);
  }
}

export function sanitizeProxyError(value: string | null | undefined) {
  if (!value) return null;
  return value.trim()
    .replace(/\?[^\s"'<>]*/g, "?[redacted]")
    .replace(/(authorization|cookie)\s*[:=]\s*\S+/gi, "$1=[redacted]")
    .slice(0, 500) || null;
}

export function minuteBucket(date: Date) {
  const result = new Date(date);
  result.setUTCSeconds(0, 0);
  return result;
}

export function validObservedAt(date: Date, retentionDays = env.dataRetentionDays) {
  const time = date.getTime();
  return Number.isFinite(time)
    && time <= Date.now() + 5 * 60 * 1000
    && time >= Date.now() - retentionDays * 24 * 60 * 60 * 1000;
}
