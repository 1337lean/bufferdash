import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const describeWithDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeWithDatabase("analytics queries", () => {
  let prisma: typeof import("../lib/prisma").prisma;
  let siteId = "";
  let userId = "";
  let visitorId = "";

  beforeAll(async () => {
    prisma = (await import("../lib/prisma")).prisma;
    const suffix = Date.now().toString(36);
    const user = await prisma.user.create({ data: { email: `integration-${suffix}@example.test`, passwordHash: "test" } });
    userId = user.id;
    const site = await prisma.site.create({ data: { name: "Integration", domain: `integration-${suffix}.test`, publicKey: `integration-${suffix}`, ownerId: user.id } });
    siteId = site.id;
    const visitor = await prisma.visitor.create({ data: { visitorKey: `integration-visitor-${suffix}` } });
    visitorId = visitor.id;
    const session = await prisma.session.create({ data: { sessionKey: `integration-session-${suffix}`, siteId, visitorId, endedAt: new Date(), durationMs: 30_000 } });
    await prisma.event.create({ data: {
      siteId, visitorId, sessionId: session.id, type: "pageview", path: "/test", browser: "Test Browser",
      os: "Test OS", device: "desktop", country: "US", city: "New York", createdAt: new Date()
    } });
  });

  afterAll(async () => {
    if (userId) await prisma.user.delete({ where: { id: userId } });
    if (visitorId) await prisma.visitor.delete({ where: { id: visitorId } });
    await prisma.$disconnect();
  });

  it("returns ranged metrics, breakdowns, bounce rate, and timeline", async () => {
    const { getDashboardData } = await import("../lib/data");
    const data = await getDashboardData(siteId, "24h");
    expect(data.overview.pageViews).toBe(1);
    expect(data.overview.uniqueVisitors).toBe(1);
    expect(data.overview.sessions).toBe(1);
    expect(data.overview.bounceRate).toBe(100);
    expect(data.countries).toContainEqual({ label: "US", value: 1 });
    expect(data.cities).toContainEqual({ label: "New York", value: 1 });
    expect(data.overview.timeline.reduce((sum, bucket) => sum + bucket.pageviews, 0)).toBe(1);
  });
});
