import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSecurityEvents } from "@/lib/data";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const events = await getSecurityEvents();
  return NextResponse.json({ events });
}
