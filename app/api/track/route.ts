import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getClientIp } from "@/lib/ip";
import { rateLimit } from "@/lib/rate-limit";
import { recordTrackingEvent, trackSchema } from "@/lib/tracking";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type"
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const limit = rateLimit(`track:${ip}`, env.trackingRateLimit);
  if (!limit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: corsHeaders });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: corsHeaders });
  }

  const parsed = trackSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400, headers: corsHeaders });
  }

  const result = await recordTrackingEvent(parsed.data, ip, request.headers.get("user-agent"));
  if (!result.ok) {
    return NextResponse.json({ error: "unknown_site" }, { status: result.status, headers: corsHeaders });
  }

  return new NextResponse(null, { status: 204, headers: corsHeaders });
}
