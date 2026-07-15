"use server";

import { nanoid } from "nanoid";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  assertCsrf,
  csrfCookieOptions,
  CSRF_COOKIE,
  createSessionToken,
  ensureAdminUser,
  newCsrfToken,
  requireAdmin,
  sessionCookieOptions,
  SESSION_COOKIE,
  verifyAdminCredentials
} from "@/lib/auth";
import { env } from "@/lib/env";
import { getClientIpFromHeaders } from "@/lib/ip";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { recordSecurityEvent } from "@/lib/security-events";

export type ActionState = {
  error?: string;
  success?: string;
};

const siteSchema = z.object({
  name: z.string().min(2).max(80),
  domain: z.string().min(3).max(180)
});

export async function loginAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const headerStore = await headers();
  const ip = getClientIpFromHeaders(headerStore) || email || "login";
  const limit = rateLimit(`login:${ip}:${email}`, env.adminRateLimit);

  if (!limit.allowed) {
    await recordSecurityEvent({ source: "auth", type: "login_rate_limited", ip, message: "Admin login rate limit exceeded", metadata: { email: email.slice(0, 120) } });
    return { error: "Too many login attempts. Wait a minute and try again." };
  }

  const isValid = await verifyAdminCredentials(email, password);
  if (!isValid) {
    await recordSecurityEvent({ source: "auth", type: "login_failed", ip, message: "Invalid admin login attempt", metadata: { email: email.slice(0, 120) } });
    return { error: "Invalid email or password." };
  }

  await ensureAdminUser();

  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(env.adminEmail), sessionCookieOptions());
  store.set(CSRF_COOKIE, newCsrfToken(), csrfCookieOptions());
  redirect("/dashboard");
}

export async function logoutAction(formData: FormData) {
  await requireAdmin();
  await assertCsrf(formData);
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(CSRF_COOKIE);
  redirect("/login");
}

export async function createSiteAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  await assertCsrf(formData);

  const parsed = siteSchema.safeParse({
    name: formData.get("name"),
    domain: normalizeDomain(String(formData.get("domain") || ""))
  });

  if (!parsed.success) {
    return { error: "Enter a site name and a valid domain." };
  }

  const owner = await ensureAdminUser();
  const publicKey = slugKey(parsed.data.domain);

  const site = await prisma.site.create({
    data: {
      ...parsed.data,
      publicKey,
      ownerId: owner.id
    }
  });

  redirect(`/sites/${site.id}?created=1`);
}

export async function deleteSiteAction(formData: FormData) {
  await requireAdmin();
  await assertCsrf(formData);
  const id = String(formData.get("siteId") || "");
  if (id) {
    await prisma.site.delete({ where: { id } });
  }
  redirect("/sites");
}

export async function deleteOldDataAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  await assertCsrf(formData);
  const days = Number(formData.get("days") || env.dataRetentionDays);
  if (!Number.isFinite(days) || days < 1 || days > 3650) {
    return { error: "Choose a retention window between 1 and 3650 days." };
  }

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  await prisma.$transaction(async (tx) => {
    await tx.event.deleteMany({ where: { createdAt: { lt: cutoff } } });
    await tx.securityEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
    await tx.serverMetric.deleteMany({ where: { createdAt: { lt: cutoff } } });
    await tx.httpErrorSample.deleteMany({ where: { occurredAt: { lt: cutoff } } });
    await tx.httpRequestBucket.deleteMany({ where: { bucketStart: { lt: cutoff } } });
    await tx.ingestBatch.deleteMany({ where: { receivedAt: { lt: new Date(Date.now() - 7 * 86_400_000) } } });
    await tx.session.deleteMany({ where: { endedAt: { lt: cutoff } } });
    await tx.visitor.deleteMany({ where: { events: { none: {} }, sessions: { none: {} } } });
  });

  return { success: `Deleted analytics, HTTP diagnostics, sessions, visitors, security events, and metrics older than ${days} days.` };
}

function normalizeDomain(value: string) {
  return value.replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim().toLowerCase();
}

function slugKey(domain: string) {
  const base = domain.replace(/^www\./, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${base || "site"}-${nanoid(6).toLowerCase()}`;
}
