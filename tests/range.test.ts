import { describe, expect, it } from "vitest";
import { parseRange, rangeStart } from "../lib/range";

describe("analytics ranges", () => {
  it("rejects unknown range values", () => {
    expect(parseRange("all-time")).toBe("24h");
  });

  it("uses seven calendar days including today", () => {
    const now = new Date(2026, 6, 10, 13, 30);
    const start = rangeStart("7d", now);
    expect(start.getDate()).toBe(4);
    expect(start.getHours()).toBe(0);
  });
});
