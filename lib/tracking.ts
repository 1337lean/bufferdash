import "server-only";

import type { Prisma } from "@prisma/client";
import { UAParser } from "ua-parser-js";
import { z } from "zod";
import { detectBot, isSuspiciousPath } from "@/lib/bot";
import { assertRuntimeEnv, env } from "@/lib/env";
import { hashIp, storedIp } from "@/lib/ip";
import { isAllowedTrackingOrigin } from "@/lib/origin";
import { resolveGeo } from "@/lib/geo";
import { prisma } from "@/lib/prisma";

export const trackSchema = z.object({
  siteId: z.string().min(1).max(120),
  type: z.string().min(1).max(80).default("pageview"),
  path: z.string().max(500).optional().nullable(),
  url: z.string().max(1000).optional().nullable(),
  referrer: z.string().max(1000).optional().nullable(),
  title: z.string().max(300).optional().nullable(),
  screenWidth: z.number().int().positive().max(20000).optional().nullable(),
  screenHeight: z.number().int().positive().max(20000).optional().nullable(),
  language: z.string().max(80).optional().nullable(),
  timezone: z.string().max(120).optional().nullable(),
  visitorId: z.string().min(8).max(160),
  sessionId: z.string().min(8).max(160),
  durationMs: z.number().int().min(0).max(86_400_000).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable()
});

export function referrerDomain(referrer?: string | null) {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function trimMetadata(metadata: Record<string, unknown> | null | undefined): Prisma.InputJsonObject | undefined {
  if (!metadata) return undefined;
  return Object.fromEntries(
    Object.entries(metadata)
      .slice(0, 20)
      .map(([key, value]) => [key.slice(0, 80), jsonValue(value)])
  ) as Prisma.InputJsonObject;
}

function eventMetadata(type: string, metadata: Record<string, unknown> | null | undefined) {
  if (type !== "tool_used") return trimMetadata(metadata);
  const tool = String(metadata?.tool || "").trim().slice(0, 120);
  return trimMetadata(tool ? { ...metadata, tool } : metadata);
}

function jsonValue(value: unknown, depth = 0): Prisma.InputJsonValue {
  if (depth >= 4) return "[truncated]";
  if (value === null) return "";
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return value.slice(0, 500);
  if (Array.isArray(value)) return value.slice(0, 20).map((child) => jsonValue(child, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 20)
        .map(([key, child]) => [key.slice(0, 80), jsonValue(child, depth + 1)])
    ) as Prisma.InputJsonObject;
  }
  return String(value).slice(0, 120);
}

export async function recordTrackingEvent(input: z.infer<typeof trackSchema>, ip: string, userAgent: string | null, origin: string | null, headers = new Headers()) {
  assertRuntimeEnv();
  const site = await prisma.site.findUnique({ where: { publicKey: input.siteId } });
  if (!site) return { ok: false as const, status: 404 };
  if (env.enforceTrackingOrigin && !isAllowedTrackingOrigin(origin, site.domain)) {
    return { ok: false as const, status: 403 };
  }

  const bot = detectBot(userAgent);
  if (env.filterBots && bot.isBot) {
    return { ok: true as const, status: 204 };
  }

  const now = new Date();
  const durationMs = input.durationMs == null ? null : Math.min(Math.max(0, input.durationMs), 86_400_000);
  const { visitor, session } = await prisma.$transaction(async (tx) => {
    const visitor = await tx.visitor.upsert({
      where: { visitorKey: `${site.publicKey}:${input.visitorId}` },
      update: { lastSeenAt: now },
      create: { visitorKey: `${site.publicKey}:${input.visitorId}`, lastSeenAt: now }
    });
    const session = await tx.session.upsert({
      where: { sessionKey: `${site.publicKey}:${input.sessionId}` },
      update: { endedAt: now, visitorId: visitor.id },
      create: {
        sessionKey: `${site.publicKey}:${input.sessionId}`,
        siteId: site.id,
        visitorId: visitor.id,
        endedAt: now,
        durationMs: durationMs || 0
      }
    });
    if (durationMs !== null) {
      await tx.session.updateMany({
        where: { id: session.id, OR: [{ durationMs: null }, { durationMs: { lt: durationMs } }] },
        data: { durationMs, endedAt: now }
      });
    }
    return { visitor, session };
  });

  if (input.type === "session_ping" || input.type === "pagehide") {
    return { ok: true as const, status: 204 };
  }

  const parser = new UAParser(userAgent || "");
  const ua = parser.getResult();
  const ipHash = hashIp(ip);
  const persistedIp = storedIp(ip);
  const geo = await resolveGeo(ip, headers);

  const event = await prisma.event.create({
    data: {
      siteId: site.id,
      visitorId: visitor.id,
      sessionId: session.id,
      type: input.type,
      path: input.path || null,
      url: input.url || null,
      title: input.title || null,
      referrer: input.referrer || null,
      referrerDomain: referrerDomain(input.referrer),
      ipAddress: persistedIp,
      ipHash,
      country: geo.country,
      region: geo.region,
      city: geo.city,
      asn: geo.asn,
      isp: geo.isp,
      userAgent: userAgent || null,
      browser: ua.browser.name || null,
      os: ua.os.name || null,
      device: ua.device.type || "desktop",
      screenWidth: input.screenWidth || null,
      screenHeight: input.screenHeight || null,
      language: input.language || null,
      timezone: input.timezone || null,
      isBot: bot.isBot,
      botName: bot.botName,
      metadata: eventMetadata(input.type, input.metadata)
    }
  });

  if (bot.isBot || isSuspiciousPath(input.path)) {
    await prisma.securityEvent.create({
      data: {
        source: "tracker",
        type: bot.isBot ? "bot" : "suspicious_path",
        ipAddress: persistedIp,
        ipHash,
        message: bot.isBot
          ? `${bot.botName || "Bot"} visited ${input.path || "/"}`
          : `Suspicious path requested: ${input.path}`,
        isBot: bot.isBot,
        botName: bot.botName,
        metadata: {
          siteId: site.id,
          eventId: event.id,
          userAgent,
          path: input.path
        }
      }
    });
  }

  return { ok: true as const, status: 204 };
}
