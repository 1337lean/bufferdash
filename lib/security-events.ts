import "server-only";
import { hashIp, storedIp } from "@/lib/ip";
import { prisma } from "@/lib/prisma";

export async function recordSecurityEvent(input: { source: string; type: string; ip?: string | null; message: string; metadata?: Record<string, string | number | boolean | null> }) {
  try {
    const ip = input.ip || null;
    await prisma.securityEvent.create({
      data: {
        source: input.source.slice(0, 80), type: input.type.slice(0, 80),
        ipAddress: ip ? storedIp(ip) : null, ipHash: ip ? hashIp(ip) : null,
        message: input.message.slice(0, 500), metadata: input.metadata
      }
    });
  } catch {
    // Telemetry must never make login or public error handling unavailable.
  }
}
