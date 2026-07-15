import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { ingestionAuthorized, validObservedAt } from "@/lib/ingestion";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export const hostIngestSchema = z.object({
  sampleKey: z.string().min(8).max(200),
  timestamp: z.string().datetime({ offset: true }),
  hostname: z.string().min(1).max(255),
  agentVersion: z.string().max(80).optional().nullable(),
  cpuPercent: z.number().finite().min(0).max(100),
  memoryUsedMb: z.number().finite().min(0).max(100_000_000),
  memoryTotalMb: z.number().finite().positive().max(100_000_000),
  diskUsedGb: z.number().finite().min(0).max(10_000_000),
  diskTotalGb: z.number().finite().positive().max(10_000_000),
  load1: z.number().finite().min(0).max(1_000_000),
  load5: z.number().finite().min(0).max(1_000_000),
  load15: z.number().finite().min(0).max(1_000_000),
  uptimeSeconds: z.number().int().min(0).max(2_147_483_647),
  networkRxBytes: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  networkTxBytes: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)
}).refine((value) => value.memoryUsedMb <= value.memoryTotalMb * 1.02, "memory used exceeds total")
  .refine((value) => value.diskUsedGb <= value.diskTotalGb * 1.02, "disk used exceeds total");

export async function POST(request: NextRequest) {
  if (!env.enableHostIngestion || !ingestionAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!rateLimit(`ingest-host:${request.headers.get("authorization")?.slice(-12) || "agent"}`, 10).allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const raw = await request.text();
  if (raw.length > 32_768) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  let json: unknown;
  try { json = JSON.parse(raw); } catch { json = null; }
  const parsed = hostIngestSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  const timestamp = new Date(parsed.data.timestamp);
  if (!validObservedAt(timestamp)) return NextResponse.json({ error: "invalid_timestamp" }, { status: 400 });
  await prisma.$transaction([
    prisma.serverMetric.upsert({ where: { sampleKey: parsed.data.sampleKey }, update: {}, create: {
        sampleKey: parsed.data.sampleKey,
        createdAt: timestamp,
        hostname: parsed.data.hostname,
        scope: "host",
        cpuPercent: parsed.data.cpuPercent,
        memoryUsedMb: parsed.data.memoryUsedMb,
        memoryTotalMb: parsed.data.memoryTotalMb,
        diskUsedGb: parsed.data.diskUsedGb,
        diskTotalGb: parsed.data.diskTotalGb,
        load1: parsed.data.load1,
        load5: parsed.data.load5,
        load15: parsed.data.load15,
        uptimeSeconds: parsed.data.uptimeSeconds,
        networkRxBytes: BigInt(parsed.data.networkRxBytes),
        networkTxBytes: BigInt(parsed.data.networkTxBytes)
      }
    }),
    prisma.ingestionSource.upsert({
      where: { name: "host" },
      update: { lastSeenAt: new Date(), hostname: parsed.data.hostname, agentVersion: parsed.data.agentVersion || undefined },
      create: { name: "host", lastSeenAt: new Date(), hostname: parsed.data.hostname, agentVersion: parsed.data.agentVersion || null }
    })
  ]);
  return new NextResponse(null, { status: 204 });
}
