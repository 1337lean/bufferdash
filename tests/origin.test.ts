import { describe, expect, it } from "vitest";
import { isAllowedTrackingOrigin } from "../lib/origin";

describe("tracking origin validation", () => {
  it("accepts the configured site and its www equivalent", () => {
    expect(isAllowedTrackingOrigin("https://buffer.lol", "buffer.lol")).toBe(true);
    expect(isAllowedTrackingOrigin("https://www.buffer.lol", "buffer.lol")).toBe(true);
  });

  it("rejects unrelated and missing origins", () => {
    expect(isAllowedTrackingOrigin("https://example.com", "buffer.lol")).toBe(false);
    expect(isAllowedTrackingOrigin(null, "buffer.lol")).toBe(false);
    expect(isAllowedTrackingOrigin("null", "buffer.lol")).toBe(false);
  });
});
