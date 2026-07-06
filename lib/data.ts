import "server-only";

import type { Event, SecurityEvent, Site } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type TopRow = {
  label: string;
  value: number;
};

export function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export function sinceHours(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

export async function getSites() {
  return prisma.site.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { events: true, sessions: true } }
    }
  });
}

export async function getSite(siteId: string) {
  return prisma.site.findUnique({
    where: { id: siteId },
    include: {
      _count: { select: { events: true, sessions: true } }
    }
  });
}

export async function getOverview(siteId?: string) {
  const today = startOfToday();
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const where = siteId ? { siteId } : {};
  const todayWhere = { ...where, createdAt: { gte: today } };

  const [pageViewsToday, visitorsToday, sessionsToday, liveVisitors, sessions, events, sites, securityEvents] =
    await Promise.all([
      prisma.event.count({ where: { ...todayWhere, type: "pageview" } }),
      prisma.event.groupBy({
        by: ["visitorId"],
        where: { ...todayWhere, visitorId: { not: null } }
      }),
      prisma.session.count({ where: { ...where, startedAt: { gte: today } } }),
      prisma.event.groupBy({
        by: ["visitorId"],
        where: { ...where, createdAt: { gte: fiveMinutesAgo }, visitorId: { not: null } }
      }),
      prisma.session.findMany({
        where: { ...where, startedAt: { gte: today }, durationMs: { not: null } },
        select: { durationMs: true }
      }),
      prisma.event.findMany({
        where: { ...where, createdAt: { gte: sinceHours(24) } },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true, type: true }
      }),
      prisma.site.count(),
      prisma.securityEvent.count({ where: { createdAt: { gte: today } } })
    ]);

  const averageSessionDuration =
    sessions.length === 0
      ? 0
      : sessions.reduce((total, session) => total + (session.durationMs || 0), 0) / sessions.length;

  return {
    pageViewsToday,
    uniqueVisitorsToday: visitorsToday.length,
    sessionsToday,
    liveVisitors: liveVisitors.length,
    averageSessionDuration,
    sites,
    securityEvents,
    timeline: buildHourlyTimeline(events)
  };
}

export async function topByField(
  field: "path" | "referrerDomain" | "country" | "browser" | "os" | "device",
  siteId?: string,
  limit = 6
): Promise<TopRow[]> {
  const rows = await prisma.event.groupBy({
    by: [field],
    where: {
      ...(siteId ? { siteId } : {}),
      [field]: { not: null }
    },
    _count: { _all: true },
    orderBy: { _count: { [field]: "desc" } },
    take: limit
  });

  return rows.map((row) => ({
    label: String(row[field] || "Unknown"),
    value: row._count._all
  }));
}

export async function getDashboardData(siteId?: string) {
  const [overview, topPages, referrers, countries, browsers, os, devices] = await Promise.all([
    getOverview(siteId),
    topByField("path", siteId),
    topByField("referrerDomain", siteId),
    topByField("country", siteId),
    topByField("browser", siteId),
    topByField("os", siteId),
    topByField("device", siteId)
  ]);

  return { overview, topPages, referrers, countries, browsers, os, devices };
}

export async function getRecentEvents(siteId?: string, limit = 40) {
  return prisma.event.findMany({
    where: siteId ? { siteId } : {},
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { site: true }
  });
}

export async function getLiveVisitors(siteId?: string) {
  const events = await prisma.event.findMany({
    where: {
      ...(siteId ? { siteId } : {}),
      createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }
    },
    orderBy: { createdAt: "desc" },
    include: { site: true },
    take: 100
  });

  const seen = new Set<string>();
  return events.filter((event) => {
    const key = event.visitorId || event.ipHash || event.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function getSecurityEvents(limit = 80) {
  return prisma.securityEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: limit
  });
}

export async function getSuspiciousIps() {
  const rows = await prisma.securityEvent.groupBy({
    by: ["ipHash"],
    where: { ipHash: { not: null }, createdAt: { gte: sinceHours(24) } },
    _count: { _all: true },
    orderBy: { _count: { ipHash: "desc" } },
    take: 10
  });

  return rows.map((row) => ({
    label: row.ipHash?.slice(0, 12) || "unknown",
    value: row._count._all
  }));
}

export async function getAppLogs() {
  const [security, tracking] = await Promise.all([
    prisma.securityEvent.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.event.findMany({ orderBy: { createdAt: "desc" }, include: { site: true }, take: 40 })
  ]);

  return [
    ...security.map((event: SecurityEvent) => ({
      id: event.id,
      createdAt: event.createdAt,
      source: event.source,
      type: event.type,
      message: event.message
    })),
    ...tracking.map((event: Event & { site: Site }) => ({
      id: event.id,
      createdAt: event.createdAt,
      source: event.site.name,
      type: event.type,
      message: `${event.path || event.url || "event"} from ${event.browser || "unknown browser"}`
    }))
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 80);
}

function buildHourlyTimeline(events: Array<{ createdAt: Date; type: string }>) {
  const buckets = Array.from({ length: 24 }, (_, index) => {
    const date = new Date(Date.now() - (23 - index) * 60 * 60 * 1000);
    date.setMinutes(0, 0, 0);
    return {
      key: date.toISOString(),
      time: date.toLocaleTimeString("en-US", { hour: "numeric" }),
      pageviews: 0,
      events: 0
    };
  });

  const indexByKey = new Map(buckets.map((bucket, index) => [bucket.key, index]));

  for (const event of events) {
    const date = new Date(event.createdAt);
    date.setMinutes(0, 0, 0);
    const index = indexByKey.get(date.toISOString());
    if (index === undefined) continue;
    buckets[index].events += 1;
    if (event.type === "pageview") buckets[index].pageviews += 1;
  }

  return buckets;
}
