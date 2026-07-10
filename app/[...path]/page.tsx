import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { isSuspiciousPath } from "@/lib/bot";
import { env } from "@/lib/env";
import { getClientIpFromHeaders } from "@/lib/ip";
import { rateLimit } from "@/lib/rate-limit";
import { recordSecurityEvent } from "@/lib/security-events";

export default async function UnknownPathPage({ params }: { params: Promise<{ path: string[] }> }) {
  const path = `/${(await params).path.join("/")}`.slice(0, 500);
  const headerStore = await headers();
  const ip = getClientIpFromHeaders(headerStore) || "0.0.0.0";
  if (rateLimit(`not-found:${ip}`, Math.min(env.trackingRateLimit, 30)).allowed) {
    await recordSecurityEvent({
      source: "http",
      type: isSuspiciousPath(path) ? "suspicious_path" : "not_found",
      ip,
      message: `Unknown path requested: ${path}`,
      metadata: { path, userAgent: (headerStore.get("user-agent") || "").slice(0, 300) }
    });
  }
  notFound();
}
