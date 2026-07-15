import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("ingestion sanitization", () => {
  it("strips query strings and fragments from paths", async () => {
    const { sanitizeRequestPath } = await import("../lib/ingestion");
    expect(sanitizeRequestPath("/api/check?token=secret#fragment")).toBe("/api/check");
    expect(sanitizeRequestPath("https://dash.buffer.lol/health?private=1")).toBe("/health");
  });

  it("minute-aligns HTTP buckets in UTC", async () => {
    const { minuteBucket } = await import("../lib/ingestion");
    expect(minuteBucket(new Date("2026-07-15T12:34:56.789Z")).toISOString()).toBe("2026-07-15T12:34:00.000Z");
  });

  it("redacts query and credential-like values from proxy errors", async () => {
    const { sanitizeProxyError } = await import("../lib/ingestion");
    expect(sanitizeProxyError("upstream https://example.test/fail?token=secret Authorization: bearer-secret"))
      .toBe("upstream https://example.test/fail?[redacted] Authorization=[redacted]");
  });
});
