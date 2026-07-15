import crypto from "crypto";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";

export function getClientIpFromHeaders(headers: Headers) {
  if (env.trustProxy) {
    // Caddy overwrites these headers after strict trusted-proxy parsing.
    const forwarded = headers.get("x-forwarded-for");
    if (forwarded) {
      return forwarded.split(",")[0]?.trim() || null;
    }

    const realIp = headers.get("x-real-ip");
    if (realIp) {
      return realIp.trim();
    }

    return null;
  }

  return null;
}

export function getClientIp(request: NextRequest | Request) {
  return getClientIpFromHeaders(request.headers) || "0.0.0.0";
}

export function anonymizeIp(ip: string) {
  if (!ip) return null;

  if (ip.includes(":")) {
    const parts = ip.split(":");
    return `${parts.slice(0, 4).join(":")}::`;
  }

  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }

  return ip;
}

export function hashIp(ip: string) {
  return crypto.createHmac("sha256", env.trackingSecret).update(ip).digest("hex");
}

export function storedIp(ip: string) {
  return env.anonymizeIp ? anonymizeIp(ip) : ip;
}

export function maskIp(ip?: string | null) {
  if (!ip) return "unknown";
  if (ip.includes(":")) return anonymizeIp(ip) || ip;
  return anonymizeIp(ip) || ip;
}
