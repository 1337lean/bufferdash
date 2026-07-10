import { describe, expect, it, vi } from "vitest";

describe("GeoIP helpers", () => {
  it("uses trusted proxy geo headers", async () => {
    vi.resetModules();
    vi.stubEnv("TRUST_PROXY", "true");
    const { geoFromTrustedHeaders } = await import("../lib/geo");
    const headers = new Headers({ "cf-ipcountry": "US", "x-vercel-ip-city": "New%20York", "x-vercel-ip-country-region": "NY" });
    expect(geoFromTrustedHeaders(headers)).toMatchObject({ country: "US", city: "New York", region: "NY" });
  });

  it("does not send private addresses to a provider", async () => {
    const { isPublicIp } = await import("../lib/geo");
    expect(isPublicIp("192.168.1.2")).toBe(false);
    expect(isPublicIp("8.8.8.8")).toBe(true);
  });
});
