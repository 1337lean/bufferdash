import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { env } from "@/lib/env";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({
    anonymizeIp: env.anonymizeIp,
    trustProxy: env.trustProxy,
    enableServerMetrics: env.enableServerMetrics,
    enableLogIngestion: env.enableLogIngestion,
    dataRetentionDays: env.dataRetentionDays,
    filterBots: env.filterBots
  });
}
