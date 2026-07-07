import "server-only";

import { Prisma, type Event, type SecurityEvent, type Site } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type TopRow = {
  label: string;
  value: number;
};

export function startOfToday(now = new Date()) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function sinceHours(hours: number, now = new Date()) {
  return new Date(now.getTime() - hours * 60 * 60 * 1000);
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
  const now = new Date();
  const today = startOfToday(now);
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const timelineStart = startOfHour(sinceHours(23, now));
  const where = siteId ? { siteId } : {};
  const todayWhere = { ...where, createdAt: { gte: today } };

  const [pageViewsToday, uniqueVisitorsToday, sessionsToday, liveVisitors, sessionDuration, timeline, sites, securityEvents] =
    await Promise.all([
      prisma.event.count({ where: { ...todayWhere, type: "pageview" } }),
      countDistinctVisitorsSince(today, siteId),
      prisma.session.count({ where: { ...where, startedAt: { gte: today } } }),
      countDistinctVisitorsSince(fiveMinutesAgo, siteId),
      prisma.session.aggregate({
        where: { ...where, startedAt: { gte: today }, durationMs: { not: null } },
        _avg: { durationMs: true }
      }),
      getHourlyTimeline(timelineStart, now, siteId),
      prisma.site.count(),
      prisma.securityEvent.count({ where: { createdAt: { gte: today } } })
    ]);

  return {
    pageViewsToday,
    uniqueVisitorsToday,
    sessionsToday,
    liveVisitors,
    averageSessionDuration: sessionDuration._avg.durationMs || 0,
    sites,
    securityEvents,
    timeline
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
  const now = new Date();
  const events = await prisma.event.findMany({
    where: {
      ...(siteId ? { siteId } : {}),
      createdAt: { gte: new Date(now.getTime() - 5 * 60 * 1000) }
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

type HourlyTimelineRow = {
  hour: Date;
  pageviews: bigint | number;
  events: bigint | number;
};

function siteSqlFilter(siteId?: string) {
  return siteId ? Prisma.sql`AND "siteId" = ${siteId}` : Prisma.empty;
}

async function countDistinctVisitorsSince(since: Date, siteId?: string) {
  const rows = await prisma.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`
    SELECT COUNT(DISTINCT "visitorId") AS "count"
    FROM "Event"
    WHERE "createdAt" >= ${since}
      AND "visitorId" IS NOT NULL
      ${siteSqlFilter(siteId)}
  `);

  return Number(rows[0]?.count || 0);
}

async function getHourlyTimeline(start: Date, now: Date, siteId?: string) {
  const rows = await prisma.$queryRaw<HourlyTimelineRow[]>(Prisma.sql`
    SELECT
      date_trunc('hour', "createdAt") AS "hour",
      COUNT(*) FILTER (WHERE "type" = 'pageview') AS "pageviews",
      COUNT(*) AS "events"
    FROM "Event"
    WHERE "createdAt" >= ${start}
      ${siteSqlFilter(siteId)}
    GROUP BY 1
    ORDER BY 1 ASC
  `);

  return buildHourlyTimeline(rows, now);
}

function startOfHour(date: Date) {
  const hour = new Date(date);
  hour.setMinutes(0, 0, 0);
  return hour;
}

function buildHourlyTimeline(rows: HourlyTimelineRow[], now: Date) {
  const buckets = Array.from({ length: 24 }, (_, index) => {
    const date = startOfHour(new Date(now.getTime() - (23 - index) * 60 * 60 * 1000));
    return {
      key: date.toISOString(),
      time: date.toLocaleTimeString("en-US", { hour: "numeric" }),
      pageviews: 0,
      events: 0
    };
  });

  const indexByKey = new Map(buckets.map((bucket, index) => [bucket.key, index]));

  for (const row of rows) {
    const date = startOfHour(new Date(row.hour));
    const index = indexByKey.get(date.toISOString());
    if (index === undefined) continue;
    buckets[index].events = Number(row.events || 0);
    buckets[index].pageviews = Number(row.pageviews || 0);
  }

  return buckets;
}
