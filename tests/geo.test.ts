import { afterEach, describe, expect, it, vi } from "vitest";

describe("GeoIP helpers", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("uses trusted proxy geo headers", async () => {
    vi.resetModules();
    vi.stubEnv("TRUST_PROXY", "true");
    const { geoFromTrustedHeaders } = await import("../lib/geo");
    const headers = new Headers({ "cf-ipcountry": "US", "x-vercel-ip-city": "New%20York", "x-vercel-ip-country-region": "NY" });
    expect(geoFromTrustedHeaders(headers)).toMatchObject({ country: "US", city: "New York", region: "NY" });
  });

  it("uses Cloudflare visitor location headers without a provider", async () => {
    vi.resetModules();
    vi.stubEnv("TRUST_PROXY", "true");
    const { geoFromTrustedHeaders } = await import("../lib/geo");
    const headers = new Headers({ "cf-ipcountry": "US", "cf-ipcity": "Philadelphia", "cf-region": "Pennsylvania" });
    expect(geoFromTrustedHeaders(headers)).toMatchObject({ country: "US", city: "Philadelphia", region: "Pennsylvania" });
  });

  it("does not send private addresses to a provider", async () => {
    const { isPublicIp } = await import("../lib/geo");
    expect(isPublicIp("192.168.1.2")).toBe(false);
    expect(isPublicIp("8.8.8.8")).toBe(true);
  });

  it("merges country-only trusted headers with IPinfo Core city fields", async () => {
    vi.resetModules();
    vi.stubEnv("TRUST_PROXY", "true"); vi.stubEnv("IPINFO_TOKEN", "test-token"); vi.stubEnv("IPINFO_TIER", "core");
    const provider = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ geo: { country: "CA", region: "NY", city: "New York" }, as: { asn: "AS64500", name: "Example ISP" } }) });
    vi.stubGlobal("fetch", provider);
    const { resolveGeo } = await import("../lib/geo");
    const value = await resolveGeo("8.8.4.4", new Headers({ "cf-ipcountry": "US" }));
    expect(value).toEqual({ country: "US", region: "NY", city: "New York", asn: "AS64500", isp: "Example ISP" });
    expect(provider).toHaveBeenCalledOnce();
  });

  it("never calls IPinfo for a private address", async () => {
    vi.resetModules(); vi.stubEnv("IPINFO_TOKEN", "test-token");
    const provider = vi.fn(); vi.stubGlobal("fetch", provider);
    const { resolveGeo } = await import("../lib/geo");
    await resolveGeo("10.0.0.5", new Headers());
    expect(provider).not.toHaveBeenCalled();
  });
});
