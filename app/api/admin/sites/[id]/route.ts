import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getDashboardData, getRecentEvents } from "@/lib/data";
import { prisma } from "@/lib/prisma";

const patchSiteSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  domain: z.string().min(3).max(180).optional()
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const site = await prisma.site.findUnique({ where: { id } });
  if (!site) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const [analytics, events] = await Promise.all([getDashboardData(id), getRecentEvents(id)]);
  return NextResponse.json({ site, analytics, events });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = patchSiteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  const { id } = await params;
  const site = await prisma.site.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ site });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.site.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
