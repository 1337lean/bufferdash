import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { ensureAdminUser, getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSiteSchema = z.object({
  name: z.string().min(2).max(80),
  domain: z.string().min(3).max(180)
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sites = await prisma.site.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ sites });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = createSiteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  const owner = await ensureAdminUser();
  const domain = parsed.data.domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim().toLowerCase();
  const publicKey = `${domain.replace(/^www\./, "").replace(/[^a-z0-9]+/g, "-")}-${nanoid(6).toLowerCase()}`;
  const site = await prisma.site.create({
    data: {
      name: parsed.data.name,
      domain,
      publicKey,
      secretKey: nanoid(32),
      ownerId: owner.id
    }
  });
  return NextResponse.json({ site }, { status: 201 });
}
