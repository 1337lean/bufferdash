import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { trafficWhere, type TrafficMode } from "@/lib/filters";

export type SecurityListInput = {
  start: Date; end: Date; page: number; pageSize: number; traffic: TrafficMode;
  type?: string; source?: string; ipHash?: string; q?: string;
};

export async function getSecurityPage(input: SecurityListInput) {
  const where: Prisma.SecurityEventWhereInput = {
    createdAt: { gte: input.start, lt: input.end },
    ...trafficWhere(input.traffic),
    ...(input.type ? { type: input.type } : {}),
    ...(input.source ? { source: input.source } : {}),
    ...(input.ipHash ? { ipHash: input.ipHash } : {}),
    ...(input.q ? { OR: [{ message: { contains: input.q, mode: "insensitive" } }, { ipAddress: { contains: input.q, mode: "insensitive" } }] } : {})
  };
  const [events, total, types, sources, signals, repeatVisitors] = await Promise.all([
    prisma.securityEvent.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
    prisma.securityEvent.count({ where }),
    prisma.securityEvent.findMany({ where: { createdAt: { gte: input.start, lt: input.end } }, distinct: ["type"], select: { type: true }, orderBy: { type: "asc" } }),
    prisma.securityEvent.findMany({ where: { createdAt: { gte: input.start, lt: input.end } }, distinct: ["source"], select: { source: true }, orderBy: { source: "asc" } }),
    prisma.securityEvent.groupBy({ by: ["type"], where, _count: { _all: true }, orderBy: { _count: { type: "desc" } }, take: 10 }),
    prisma.securityEvent.groupBy({ by: ["ipHash"], where: { ...where, ipHash: { not: null } }, _count: { _all: true }, orderBy: { _count: { ipHash: "desc" } }, take: 10 })
  ]);
  return {
    events, total,
    types: types.map((row) => row.type), sources: sources.map((row) => row.source),
    signals: signals.map((row) => ({ label: row.type.replaceAll("_", " "), value: row._count._all })),
    repeatVisitors: repeatVisitors.map((row) => ({ hash: row.ipHash!, value: row._count._all }))
  };
}

export type AppLogRow = {
  id: string; kind: "tracking" | "security"; createdAt: Date; source: string; type: string;
  message: string; siteId: string | null; isBot: boolean | null;
};

export type LogListInput = {
  start: Date; end: Date; page: number; pageSize: number; traffic: TrafficMode;
  kind?: string; type?: string; source?: string; siteId?: string; q?: string;
};

function sqlTraffic(traffic: TrafficMode, column: string) {
  const field = Prisma.raw(column);
  if (traffic === "bot") return Prisma.sql`AND ${field} = TRUE`;
  if (traffic === "human") return Prisma.sql`AND ${field} = FALSE`;
  if (traffic === "unknown") return Prisma.sql`AND ${field} IS NULL`;
  return Prisma.empty;
}

function appLogUnion(input: LogListInput) {
  const trackingEnabled = !input.kind || input.kind === "tracking";
  const securityEnabled = !input.kind || input.kind === "security";
  return Prisma.sql`
    SELECT e.id, 'tracking'::text AS kind, e."createdAt", s.name AS source, e.type,
      CONCAT(COALESCE(e.path, e.url, 'event'), ' from ', COALESCE(e.browser, 'unknown browser')) AS message,
      e."siteId", e."isBot"
    FROM "Event" e JOIN "Site" s ON s.id = e."siteId"
    WHERE ${trackingEnabled} AND e."createdAt" >= ${input.start} AND e."createdAt" < ${input.end}
      ${sqlTraffic(input.traffic, 'e."isBot"')}
      ${input.type ? Prisma.sql`AND e.type = ${input.type}` : Prisma.empty}
      ${input.source ? Prisma.sql`AND s.name = ${input.source}` : Prisma.empty}
      ${input.siteId ? Prisma.sql`AND e."siteId" = ${input.siteId}` : Prisma.empty}
      ${input.q ? Prisma.sql`AND (COALESCE(e.path, '') ILIKE ${`%${input.q}%`} OR COALESCE(e.url, '') ILIKE ${`%${input.q}%`})` : Prisma.empty}
    UNION ALL
    SELECT se.id, 'security'::text AS kind, se."createdAt", se.source, se.type, se.message,
      NULL::text AS "siteId", se."isBot"
    FROM "SecurityEvent" se
    WHERE ${securityEnabled} AND se."createdAt" >= ${input.start} AND se."createdAt" < ${input.end}
      ${sqlTraffic(input.traffic, 'se."isBot"')}
      ${input.type ? Prisma.sql`AND se.type = ${input.type}` : Prisma.empty}
      ${input.source ? Prisma.sql`AND se.source = ${input.source}` : Prisma.empty}
      ${input.siteId ? Prisma.sql`AND FALSE` : Prisma.empty}
      ${input.q ? Prisma.sql`AND se.message ILIKE ${`%${input.q}%`}` : Prisma.empty}
  `;
}

export async function getAppLogPage(input: LogListInput) {
  const union = appLogUnion(input);
  const [rows, counts, sites] = await Promise.all([
    prisma.$queryRaw<AppLogRow[]>(Prisma.sql`
      SELECT * FROM (${union}) rows
      ORDER BY "createdAt" DESC, id DESC
      LIMIT ${input.pageSize} OFFSET ${(input.page - 1) * input.pageSize}
    `),
    prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`SELECT COUNT(*) AS count FROM (${union}) rows`),
    prisma.site.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
  ]);
  return { rows, total: Number(counts[0]?.count || 0), sites };
}

export type HttpListInput = {
  start: Date; end: Date; page: number; pageSize: number; traffic: TrafficMode;
  host?: string; method?: string; statusClass?: string; status?: number; path?: string;
};

function httpBucketWhere(input: HttpListInput) {
  return Prisma.sql`
    "bucketStart" >= ${input.start} AND "bucketStart" < ${input.end}
    ${input.traffic === "bot" ? Prisma.sql`AND "trafficClass" = 'bot'` : input.traffic === "human" ? Prisma.sql`AND "trafficClass" = 'human'` : input.traffic === "unknown" ? Prisma.sql`AND FALSE` : Prisma.empty}
    ${input.host ? Prisma.sql`AND host = ${input.host}` : Prisma.empty}
    ${input.method ? Prisma.sql`AND method = ${input.method}` : Prisma.empty}
    ${input.statusClass ? Prisma.sql`AND status BETWEEN ${Number(input.statusClass[0]) * 100} AND ${Number(input.statusClass[0]) * 100 + 99}` : Prisma.empty}
    ${input.status ? Prisma.sql`AND status = ${input.status}` : Prisma.empty}
    ${input.path ? Prisma.sql`AND path ILIKE ${`%${input.path}%`}` : Prisma.empty}
  `;
}

export async function getHttpPage(input: HttpListInput) {
  const where = httpBucketWhere(input);
  const sampleWhere: Prisma.HttpErrorSampleWhereInput = {
    occurredAt: { gte: input.start, lt: input.end },
    ...(input.traffic === "bot" ? { isBot: true } : input.traffic === "human" ? { isBot: false } : input.traffic === "unknown" ? { id: "__no_classification__" } : {}),
    ...(input.host ? { host: input.host } : {}),
    ...(input.method ? { method: input.method } : {}),
    ...(input.statusClass ? { status: { gte: Number(input.statusClass[0]) * 100, lte: Number(input.statusClass[0]) * 100 + 99 } } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.path ? { path: { contains: input.path, mode: "insensitive" } } : {})
  };
  type Summary = { requests: bigint; errors4xx: bigint; errors5xx: bigint; duration: number; maximum: number };
  const [summaryRows, timeline, paths, statuses, samples, sampleCount, hosts, source] = await Promise.all([
    prisma.$queryRaw<Summary[]>(Prisma.sql`
      SELECT COALESCE(SUM("requestCount"), 0) AS requests,
        COALESCE(SUM("requestCount") FILTER (WHERE status BETWEEN 400 AND 499), 0) AS "errors4xx",
        COALESCE(SUM("requestCount") FILTER (WHERE status BETWEEN 500 AND 599), 0) AS "errors5xx",
        COALESCE(SUM("durationTotalMs") / NULLIF(SUM("requestCount"), 0), 0) AS duration,
        COALESCE(MAX("durationMaxMs"), 0) AS maximum
      FROM "HttpRequestBucket" WHERE ${where}
    `),
    prisma.$queryRaw<Array<{ bucket: Date; class: string; count: bigint }>>(Prisma.sql`
      SELECT date_trunc(${input.end.getTime() - input.start.getTime() <= 172800000 ? "hour" : "day"}, "bucketStart") AS bucket,
        CONCAT(FLOOR(status / 100), 'xx') AS class, SUM("requestCount") AS count
      FROM "HttpRequestBucket" WHERE ${where} GROUP BY 1, 2 ORDER BY 1 ASC
    `),
    prisma.$queryRaw<Array<{ label: string; count: bigint }>>(Prisma.sql`
      SELECT path AS label, SUM("requestCount") AS count FROM "HttpRequestBucket"
      WHERE ${where} AND status >= 400 GROUP BY path ORDER BY count DESC LIMIT 10
    `),
    prisma.$queryRaw<Array<{ label: number; count: bigint }>>(Prisma.sql`
      SELECT status AS label, SUM("requestCount") AS count FROM "HttpRequestBucket"
      WHERE ${where} GROUP BY status ORDER BY count DESC LIMIT 12
    `),
    prisma.httpErrorSample.findMany({ where: sampleWhere, orderBy: [{ occurredAt: "desc" }, { id: "desc" }], skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
    prisma.httpErrorSample.count({ where: sampleWhere }),
    prisma.httpRequestBucket.findMany({ distinct: ["host"], select: { host: true }, orderBy: { host: "asc" } }),
    prisma.ingestionSource.findUnique({ where: { name: "caddy" } })
  ]);
  const summary = summaryRows[0] || { requests: 0, errors4xx: 0, errors5xx: 0, duration: 0, maximum: 0 } as unknown as Summary;
  return {
    summary: { requests: Number(summary.requests), errors4xx: Number(summary.errors4xx), errors5xx: Number(summary.errors5xx), averageDuration: Number(summary.duration), maximumDuration: Number(summary.maximum) },
    timeline: timeline.map((row) => ({ bucket: row.bucket, class: row.class, count: Number(row.count) })),
    paths: paths.map((row) => ({ label: row.label, value: Number(row.count) })),
    statuses: statuses.map((row) => ({ label: String(row.label), value: Number(row.count) })),
    samples, sampleCount, hosts: hosts.map((row) => row.host), source
  };
}
