import { describe, expect, it } from "vitest";
import { isCloudflareIp } from "../lib/cloudflare";

describe("Cloudflare network detection", () => {
  it("recognizes current Cloudflare IPv4 ranges and anonymized addresses", () => {
    expect(isCloudflareIp("104.16.10.20")).toBe(true);
    expect(isCloudflareIp("172.71.0.0")).toBe(true);
    expect(isCloudflareIp("8.8.8.8")).toBe(false);
    expect(isCloudflareIp("172.72.0.1")).toBe(false);
  });

  it("recognizes current Cloudflare IPv6 ranges and anonymized addresses", () => {
    expect(isCloudflareIp("2606:4700:3037::6815:abcd")).toBe(true);
    expect(isCloudflareIp("2a06:98c7:1234:5678::")).toBe(true);
    expect(isCloudflareIp("2001:4860:4860::8888")).toBe(false);
    expect(isCloudflareIp("2a06:98c8::1")).toBe(false);
  });
});
