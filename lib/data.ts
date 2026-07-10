import "server-only";

import { Prisma, type Event, type SecurityEvent, type Site } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { rangeHours, rangeStart, type RangeKey } from "@/lib/range";

export type TopRow = { label: string; value: number };

export function sinceHours(hours: number, now = new Date()) {
  return new Date(now.getTime() - hours * 60 * 60 * 1000);
}

export async function getSites() {
  return prisma.site.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { events: true, sessions: true } } }
  });
}

export async function getSite(siteId: string) {
  return prisma.site.findUnique({
    where: { id: siteId },
    include: { _count: { select: { events: true, sessions: true } } }
  });
}

export async function getOverview(siteId: string | undefined, range: RangeKey) {
  const now = new Date();
  const start = rangeStart(range, now);
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const where = siteId ? { siteId } : {};
  const periodWhere = { ...where, createdAt: { gte: start, lte: now } };

  const [pageViews, uniqueVisitors, sessions, liveVisitors, sessionDuration, bounceRate, timeline, sites, securityEvents] =
    await Promise.all([
      prisma.event.count({ where: { ...periodWhere, type: "pageview" } }),
      countDistinctVisitors(start, now, siteId),
      prisma.session.count({ where: { ...where, startedAt: { gte: start, lte: now } } }),
      countDistinctVisitors(fiveMinutesAgo, now, siteId),
      prisma.session.aggregate({
        where: { ...where, startedAt: { gte: start, lte: now }, durationMs: { not: null } },
        _avg: { durationMs: true }
      }),
      getBounceRate(start, now, siteId),
      getTimeline(start, now, siteId, range),
      prisma.site.count(),
      prisma.securityEvent.count({ where: { createdAt: { gte: start, lte: now } } })
    ]);

  return {
    pageViews,
    uniqueVisitors,
    sessions,
    liveVisitors,
    averageSessionDuration: sessionDuration._avg.durationMs || 0,
    bounceRate,
    sites,
    securityEvents,
    timeline
  };
}

export async function topByField(
  field: "path" | "referrerDomain" | "country" | "city" | "browser" | "os" | "device",
  siteId: string | undefined,
  start: Date,
  limit = 6
): Promise<TopRow[]> {
  const rows = await prisma.event.groupBy({
    by: [field],
    where: {
      ...(siteId ? { siteId } : {}),
      createdAt: { gte: start },
      type: "pageview",
      [field]: { not: null }
    },
    _count: { _all: true },
    orderBy: { _count: { [field]: "desc" } },
    take: limit
  });

  return rows.map((row) => ({ label: String(row[field] || "Unknown"), value: row._count._all }));
}

export async function getTopTools(siteId: string | undefined, start: Date, limit = 6): Promise<TopRow[]> {
  const rows = await prisma.$queryRaw<Array<{ label: string; count: bigint | number }>>(Prisma.sql`
    SELECT "metadata"->>'tool' AS "label", COUNT(*) AS "count"
    FROM "Event"
    WHERE "type" = 'tool_used'
      AND "createdAt" >= ${start}
      AND "metadata"->>'tool' IS NOT NULL
      ${siteSqlFilter(siteId)}
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT ${limit}
  `);
  return rows.map((row) => ({ label: row.label, value: Number(row.count) }));
}

export async function getDashboardData(siteId: string | undefined, range: RangeKey) {
  const start = rangeStart(range);
  const [overview, topPages, referrers, countries, cities, browsers, operatingSystems, devices, topTools] = await Promise.all([
    getOverview(siteId, range),
    topByField("path", siteId, start),
    topByField("referrerDomain", siteId, start),
    topByField("country", siteId, start),
    topByField("city", siteId, start),
    topByField("browser", siteId, start),
    topByField("os", siteId, start),
    topByField("device", siteId, start),
    getTopTools(siteId, start)
  ]);
  return { overview, topPages, referrers, countries, cities, browsers, operatingSystems, devices, topTools };
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
    where: { ...(siteId ? { siteId } : {}), createdAt: { gte: sinceHours(5 / 60) } },
    orderBy: { createdAt: "desc" },
    include: { site: true },
    take: 200
  });
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = event.visitorId || event.ipHash || event.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function getSecurityEvents(limit = 100) {
  return prisma.securityEvent.findMany({ orderBy: { createdAt: "desc" }, take: limit });
}

export async function getSecurityEventCounts() {
  const rows = await prisma.securityEvent.groupBy({
    by: ["type"],
    where: { createdAt: { gte: sinceHours(24) } },
    _count: { _all: true },
    orderBy: { _count: { type: "desc" } },
    take: 8
  });
  return rows.map((row) => ({ label: row.type.replaceAll("_", " "), value: row._count._all }));
}

export async function getSuspiciousIps() {
  const rows = await prisma.securityEvent.groupBy({
    by: ["ipHash"],
    where: { ipHash: { not: null }, createdAt: { gte: sinceHours(24) } },
    _count: { _all: true },
    orderBy: { _count: { ipHash: "desc" } },
    take: 10
  });
  return rows.map((row) => ({ label: row.ipHash?.slice(0, 12) || "unknown", value: row._count._all }));
}

export async function getAppLogs(limit = 100) {
  const [security, tracking] = await Promise.all([
    prisma.securityEvent.findMany({ orderBy: { createdAt: "desc" }, take: limit }),
    prisma.event.findMany({ orderBy: { createdAt: "desc" }, include: { site: true }, take: limit })
  ]);
  return [
    ...security.map((event: SecurityEvent) => ({
      id: event.id, createdAt: event.createdAt, source: event.source, type: event.type, message: event.message
    })),
    ...tracking.map((event: Event & { site: Site }) => ({
      id: event.id,
      createdAt: event.createdAt,
      source: event.site.name,
      type: event.type,
      message: `${event.path || event.url || "event"} from ${event.browser || "unknown browser"}`
    }))
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
}

type TimelineRow = { bucket: Date; pageviews: bigint | number; events: bigint | number };

function siteSqlFilter(siteId?: string) {
  return siteId ? Prisma.sql`AND "siteId" = ${siteId}` : Prisma.empty;
}

async function countDistinctVisitors(start: Date, end: Date, siteId?: string) {
  const rows = await prisma.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`
    SELECT COUNT(DISTINCT "visitorId") AS "count" FROM "Event"
    WHERE "createdAt" BETWEEN ${start} AND ${end} AND "visitorId" IS NOT NULL ${siteSqlFilter(siteId)}
  `);
  return Number(rows[0]?.count || 0);
}

async function getBounceRate(start: Date, end: Date, siteId?: string) {
  const rows = await prisma.$queryRaw<Array<{ sessions: bigint | number; bounced: bigint | number }>>(Prisma.sql`
    WITH session_views AS (
      SELECT "sessionId", COUNT(*) FILTER (WHERE "type" = 'pageview') AS views
      FROM "Event"
      WHERE "createdAt" BETWEEN ${start} AND ${end} AND "sessionId" IS NOT NULL ${siteSqlFilter(siteId)}
      GROUP BY "sessionId"
    )
    SELECT COUNT(*) AS sessions, COUNT(*) FILTER (WHERE views <= 1) AS bounced FROM session_views
  `);
  const sessions = Number(rows[0]?.sessions || 0);
  return sessions ? Math.round((Number(rows[0]?.bounced || 0) / sessions) * 100) : 0;
}

async function getTimeline(start: Date, now: Date, siteId: string | undefined, range: RangeKey) {
  const isHourly = rangeHours(range) <= 48;
  const bucketExpression = isHourly ? Prisma.sql`date_trunc('hour', "createdAt")` : Prisma.sql`date_trunc('day', "createdAt")`;
  const rows = await prisma.$queryRaw<TimelineRow[]>(Prisma.sql`
    SELECT ${bucketExpression} AS bucket,
      COUNT(*) FILTER (WHERE "type" = 'pageview') AS pageviews, COUNT(*) AS events
    FROM "Event" WHERE "createdAt" BETWEEN ${start} AND ${now} ${siteSqlFilter(siteId)}
    GROUP BY 1 ORDER BY 1 ASC
  `);
  return buildTimeline(rows, start, now, isHourly);
}

function floorDate(date: Date, hourly: boolean) {
  const value = new Date(date);
  if (hourly) value.setMinutes(0, 0, 0);
  else value.setHours(0, 0, 0, 0);
  return value;
}

function buildTimeline(rows: TimelineRow[], start: Date, now: Date, hourly: boolean) {
  const step = hourly ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const first = floorDate(start, hourly);
  const last = floorDate(now, hourly);
  const buckets = [];
  for (let time = first.getTime(); time <= last.getTime(); time += step) {
    const date = new Date(time);
    buckets.push({
      key: date.toISOString(),
      time: hourly ? date.toLocaleTimeString("en-US", { hour: "numeric" }) : date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      pageviews: 0,
      events: 0
    });
  }
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  for (const row of rows) {
    const bucket = byKey.get(floorDate(new Date(row.bucket), hourly).toISOString());
    if (bucket) {
      bucket.events = Number(row.events || 0);
      bucket.pageviews = Number(row.pageviews || 0);
    }
  }
  return buckets;
}
