import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getServerMetrics } from "@/lib/server-metrics";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const metrics = await getServerMetrics();
  return NextResponse.json(metrics);
}
