import "server-only";

import bcrypt from "bcryptjs";
import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { assertProductionEnv, env, isProduction } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "bufferdash_session";
export const CSRF_COOKIE = "bufferdash_csrf";

type SessionPayload = {
  email: string;
  exp: number;
};

function base64url(input: string) {
  return Buffer.from(input).toString("base64url");
}

function sign(value: string) {
  return crypto.createHmac("sha256", env.sessionSecret).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function createSessionToken(email: string) {
  const payload = base64url(JSON.stringify({ email, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 }));
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token?: string | null): SessionPayload | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionPayload;
    if (!session.email || session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export async function getSession() {
  assertProductionEnv();
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function requireAdmin() {
  assertProductionEnv();
  const session = await getSession();
  if (!session || session.email !== env.adminEmail) {
    redirect("/login");
  }

  await ensureAdminUser();
  return session;
}

export async function verifyAdminCredentials(email: string, password: string) {
  assertProductionEnv();
  if (email.toLowerCase().trim() !== env.adminEmail.toLowerCase()) {
    return false;
  }

  if (env.adminPasswordHash) {
    return bcrypt.compare(password, env.adminPasswordHash);
  }

  return password === env.adminPassword;
}

export async function ensureAdminUser() {
  const passwordHash = env.adminPasswordHash || (await bcrypt.hash(env.adminPassword, 12));
  return prisma.user.upsert({
    where: { email: env.adminEmail },
    update: { passwordHash },
    create: { email: env.adminEmail, passwordHash }
  });
}

export function newCsrfToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export async function getCsrfToken() {
  const store = await cookies();
  return store.get(CSRF_COOKIE)?.value || "";
}

export async function assertCsrf(formData: FormData) {
  const submitted = String(formData.get("csrf") || "");
  const expected = await getCsrfToken();

  if (!submitted || !expected || !safeEqual(submitted, expected)) {
    throw new Error("Invalid security token. Refresh and try again.");
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  };
}

export function csrfCookieOptions() {
  return {
    httpOnly: false,
    secure: isProduction(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  };
}
