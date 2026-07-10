import { NextResponse } from "next/server";
import { assertProductionEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    assertProductionEnv();
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, configuration: "ok", database: "ok" });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
