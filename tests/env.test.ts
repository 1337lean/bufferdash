import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("runtime configuration", () => {
  it("rejects placeholder hosted-production values", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOCAL_ONLY", "false");
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("SESSION_SECRET", "development_session_secret_change_me");
    vi.stubEnv("TRACKING_SECRET", "development_tracking_secret_change_me");
    vi.stubEnv("ADMIN_PASSWORD_HASH", "");

    const { assertRuntimeEnv } = await import("../lib/env");
    expect(assertRuntimeEnv).toThrow(/Invalid production configuration/);
  });

  it("accepts explicit secure hosted-production values", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOCAL_ONLY", "false");
    vi.stubEnv("APP_URL", "https://dash.buffer.lol");
    vi.stubEnv("BIND_ADDRESS", "127.0.0.1");
    vi.stubEnv("SESSION_SECRET", "session-secret-with-more-than-thirty-two-characters");
    vi.stubEnv("TRACKING_SECRET", "tracking-secret-with-more-than-thirty-two-characters");
    vi.stubEnv("ADMIN_PASSWORD_HASH", "$2b$12$01234567890123456789012345678901234567890123456789012");
    vi.stubEnv("ADMIN_PASSWORD", "");
    vi.stubEnv("ADMIN_EMAIL", "owner@buffer.lol");
    vi.stubEnv("POSTGRES_PASSWORD", "database-password-with-enough-entropy");
    vi.stubEnv("DATABASE_URL", "postgresql://bufferdash:database-password-with-enough-entropy@postgres:5432/bufferdash");
    vi.stubEnv("TRUST_PROXY", "true");
    vi.stubEnv("ENFORCE_TRACKING_ORIGIN", "true");

    const { assertRuntimeEnv, shouldUseSecureCookies } = await import("../lib/env");
    expect(assertRuntimeEnv).not.toThrow();
    expect(shouldUseSecureCookies()).toBe(true);
  });

  it("rejects mismatched database credentials in hosted production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOCAL_ONLY", "false");
    vi.stubEnv("APP_URL", "https://dash.buffer.lol");
    vi.stubEnv("BIND_ADDRESS", "127.0.0.1");
    vi.stubEnv("SESSION_SECRET", "session-secret-with-more-than-thirty-two-characters");
    vi.stubEnv("TRACKING_SECRET", "tracking-secret-with-more-than-thirty-two-characters");
    vi.stubEnv("ADMIN_PASSWORD_HASH", "$2b$12$01234567890123456789012345678901234567890123456789012");
    vi.stubEnv("ADMIN_PASSWORD", "");
    vi.stubEnv("ADMIN_EMAIL", "owner@buffer.lol");
    vi.stubEnv("POSTGRES_PASSWORD", "database-password-with-enough-entropy");
    vi.stubEnv("DATABASE_URL", "postgresql://bufferdash:different-database-password@postgres:5432/bufferdash");
    vi.stubEnv("TRUST_PROXY", "true");
    vi.stubEnv("ENFORCE_TRACKING_ORIGIN", "true");

    const { assertRuntimeEnv } = await import("../lib/env");
    expect(assertRuntimeEnv).toThrow(/DATABASE_URL must match/);
  });

  it("accepts an explicitly loopback-only local configuration", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOCAL_ONLY", "true");
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("BIND_ADDRESS", "127.0.0.1");
    vi.stubEnv("DATABASE_URL", "postgresql://bufferdash:local@postgres:5432/bufferdash");
    vi.stubEnv("ADMIN_PASSWORD", "local-password");
    vi.stubEnv("ADMIN_PASSWORD_HASH", "");

    const { assertRuntimeEnv, shouldUseSecureCookies } = await import("../lib/env");
    expect(assertRuntimeEnv).not.toThrow();
    expect(shouldUseSecureCookies()).toBe(false);
  });

  it("rejects a public bind in local-only mode", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOCAL_ONLY", "true");
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("BIND_ADDRESS", "0.0.0.0");
    vi.stubEnv("DATABASE_URL", "postgresql://bufferdash:local@postgres:5432/bufferdash");
    vi.stubEnv("ADMIN_PASSWORD", "local-password");

    const { assertRuntimeEnv } = await import("../lib/env");
    expect(assertRuntimeEnv).toThrow(/BIND_ADDRESS must be a loopback address/);
  });
});
