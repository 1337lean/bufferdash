import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { detectBot } from "@/lib/bot";
import { env } from "@/lib/env";
import { anonymizeIp, hashIp } from "@/lib/ip";
import { ingestionAuthorized, minuteBucket, sanitizeProxyError, sanitizeRequestPath, validObservedAt } from "@/lib/ingestion";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const recordSchema = z.object({
  requestKey: z.string().min(8).max(200),
  timestamp: z.string().datetime({ offset: true }),
  host: z.string().min(1).max(255),
  method: z.string().min(1).max(16),
  path: z.string().min(1).max(4000),
  status: z.number().int().min(100).max(599),
  durationMs: z.number().finite().min(0).max(3_600_000),
  responseBytes: z.number().int().min(0).max(1_000_000_000_000).optional().nullable(),
  clientIp: z.string().ip(),
  userAgent: z.string().max(1000).optional().nullable(),
  cfRay: z.string().max(120).optional().nullable(),
  error: z.string().max(1000).optional().nullable()
});

export const httpIngestSchema = z.object({
  source: z.string().min(1).max(80),
  batchKey: z.string().min(8).max(200),
  hostname: z.string().max(255).optional().nullable(),
  agentVersion: z.string().max(80).optional().nullable(),
  records: z.array(recordSchema).min(1).max(100)
});

export async function POST(request: NextRequest) {
  if (!env.enableHttpIngestion || !ingestionAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!rateLimit(`ingest-http:${request.headers.get("authorization")?.slice(-12) || "agent"}`, 120).allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const raw = await request.text();
  if (raw.length > 262_144) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  let json: unknown;
  try { json = JSON.parse(raw); } catch { json = null; }
  const parsed = httpIngestSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  const records = parsed.data.records.map((record) => ({ ...record, occurredAt: new Date(record.timestamp) }));
  if (records.some((record) => !validObservedAt(record.occurredAt))) {
    return NextResponse.json({ error: "invalid_timestamp" }, { status: 400 });
  }

  const existing = await prisma.ingestBatch.findUnique({ where: { source_batchKey: { source: parsed.data.source, batchKey: parsed.data.batchKey } }, select: { id: true } });
  if (existing) return new NextResponse(null, { status: 204 });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.ingestBatch.create({ data: { source: parsed.data.source, batchKey: parsed.data.batchKey } });
      for (const record of records) {
        const path = sanitizeRequestPath(record.path);
        const method = record.method.trim().toUpperCase();
        const host = record.host.trim().toLowerCase();
        const bot = detectBot(record.userAgent);
        const trafficClass = bot.isBot ? "bot" : "human";
        const bytes = BigInt(record.responseBytes || 0);
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "HttpRequestBucket" (
            "id", "bucketStart", "host", "method", "path", "status", "trafficClass",
            "requestCount", "durationTotalMs", "durationMaxMs", "responseBytes"
          ) VALUES (
            ${crypto.randomUUID()}, ${minuteBucket(record.occurredAt)}, ${host}, ${method}, ${path}, ${record.status}, ${trafficClass},
            1, ${record.durationMs}, ${record.durationMs}, ${bytes}
          )
          ON CONFLICT ("bucketStart", "host", "method", "path", "status", "trafficClass")
          DO UPDATE SET
            "requestCount" = "HttpRequestBucket"."requestCount" + 1,
            "durationTotalMs" = "HttpRequestBucket"."durationTotalMs" + EXCLUDED."durationTotalMs",
            "durationMaxMs" = GREATEST("HttpRequestBucket"."durationMaxMs", EXCLUDED."durationMaxMs"),
            "responseBytes" = "HttpRequestBucket"."responseBytes" + EXCLUDED."responseBytes"
        `);
        if (record.status >= 400) {
          await tx.httpErrorSample.createMany({ data: [{
            requestKey: record.requestKey,
            occurredAt: record.occurredAt,
            host,
            method,
            path,
            status: record.status,
            durationMs: record.durationMs,
            responseBytes: record.responseBytes == null ? null : BigInt(record.responseBytes),
            proxyError: sanitizeProxyError(record.error),
            ipAddress: anonymizeIp(record.clientIp),
            ipHash: hashIp(record.clientIp),
            isBot: bot.isBot,
            botName: bot.botName,
            userAgent: record.userAgent?.slice(0, 500) || null,
            cfRay: record.cfRay?.slice(0, 120) || null
          }], skipDuplicates: true });
        }
      }
      await tx.ingestionSource.upsert({
        where: { name: parsed.data.source },
        update: { lastSeenAt: new Date(), hostname: parsed.data.hostname || undefined, agentVersion: parsed.data.agentVersion || undefined },
        create: { name: parsed.data.source, lastSeenAt: new Date(), hostname: parsed.data.hostname || null, agentVersion: parsed.data.agentVersion || null }
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return new NextResponse(null, { status: 204 });
    }
    throw error;
  }
  return new NextResponse(null, { status: 204 });
}
