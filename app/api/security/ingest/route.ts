import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { getClientIp } from "@/lib/ip";
import { rateLimit } from "@/lib/rate-limit";
import { recordSecurityEvent } from "@/lib/security-events";

export const ingestEventSchema = z.object({
  source: z.string().min(1).max(80),
  type: z.string().min(1).max(80),
  message: z.string().min(1).max(500),
  ip: z.string().ip().optional().nullable(),
  metadata: z.record(z.union([z.string().max(500), z.number(), z.boolean(), z.null()]))
    .refine((value) => Object.keys(value).length <= 20, "Too many metadata fields")
    .optional()
});
const bodySchema = z.union([ingestEventSchema, z.array(ingestEventSchema).min(1).max(50)]);

export async function POST(request: NextRequest) {
  if (!env.enableLogIngestion || !authorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const callerIp = getClientIp(request);
  if (!rateLimit(`ingest:${callerIp}`, 120).allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const raw = await request.text();
  if (raw.length > 65_536) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { body = null; }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  const events = Array.isArray(parsed.data) ? parsed.data : [parsed.data];
  await Promise.all(events.map((event) => recordSecurityEvent({ ...event, ip: event.ip || callerIp })));
  return new NextResponse(null, { status: 204 });
}

function authorized(header: string | null) {
  const supplied = header?.startsWith("Bearer ") ? header.slice(7) : "";
  const expected = env.ingestionSecret;
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  return Boolean(supplied && expected && left.length === right.length && crypto.timingSafeEqual(left, right));
}
