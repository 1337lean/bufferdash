import { describe, expect, it } from "vitest";
import { detectBot, isSuspiciousPath } from "../lib/bot";

describe("traffic classification", () => {
  it("recognizes known crawlers and empty user agents", () => {
    expect(detectBot("Mozilla/5.0 (compatible; Googlebot/2.1)").isBot).toBe(true);
    expect(detectBot("").isBot).toBe(true);
    expect(detectBot("Mozilla/5.0 Safari/605.1.15").isBot).toBe(false);
  });

  it("matches suspicious paths case-insensitively", () => {
    expect(isSuspiciousPath("/.ENV")).toBe(true);
    expect(isSuspiciousPath("/tools/json-formatter")).toBe(false);
  });
});
