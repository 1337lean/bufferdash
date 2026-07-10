import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("production configuration", () => {
  it("rejects placeholder deployment values", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("SESSION_SECRET", "development_session_secret_change_me");
    vi.stubEnv("TRACKING_SECRET", "development_tracking_secret_change_me");
    vi.stubEnv("ADMIN_PASSWORD_HASH", "");

    const { assertProductionEnv } = await import("../lib/env");
    expect(assertProductionEnv).toThrow(/Invalid production configuration/);
  });

  it("accepts explicit secure production values", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "https://dash.buffer.lol");
    vi.stubEnv("SESSION_SECRET", "session-secret-with-more-than-thirty-two-characters");
    vi.stubEnv("TRACKING_SECRET", "tracking-secret-with-more-than-thirty-two-characters");
    vi.stubEnv("ADMIN_PASSWORD_HASH", "$2b$12$valid-looking-test-hash");
    vi.stubEnv("ADMIN_EMAIL", "owner@buffer.lol");
    vi.stubEnv("POSTGRES_PASSWORD", "database-password-with-enough-entropy");
    vi.stubEnv("DATABASE_URL", "postgresql://bufferdash:database-password-with-enough-entropy@postgres:5432/bufferdash");

    const { assertProductionEnv } = await import("../lib/env");
    expect(assertProductionEnv).not.toThrow();
  });
});
