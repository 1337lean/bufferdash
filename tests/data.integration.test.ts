import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const describeWithDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeWithDatabase("analytics queries", () => {
  let prisma: typeof import("../lib/prisma").prisma;
  let siteId = "";
  let userId = "";
  let visitorId = "";
  const securityIds: string[] = [];

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
    const botSession = await prisma.session.create({ data: { sessionKey: `integration-bot-session-${suffix}`, siteId, visitorId, endedAt: new Date(), durationMs: 10_000 } });
    await prisma.event.create({ data: { siteId, visitorId, sessionId: botSession.id, type: "pageview", path: "/bot", isBot: true, botName: "Test bot", createdAt: new Date() } });
    await prisma.event.create({ data: { siteId, visitorId, sessionId: session.id, type: "tool_used", path: "/test", metadata: { tool: "dns-lookup" }, createdAt: new Date() } });
    const security = await prisma.securityEvent.createManyAndReturn({ data: [
      { source: "tracker", type: "bot", message: "Test bot signal", isBot: true, ipHash: `hash-${suffix}` },
      { source: "auth", type: "login_failed", message: "Test login signal", isBot: null, ipHash: `hash-${suffix}` }
    ] });
    securityIds.push(...security.map((row) => row.id));
  });

  afterAll(async () => {
    if (securityIds.length) await prisma.securityEvent.deleteMany({ where: { id: { in: securityIds } } });
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
    expect(data.topTools).toContainEqual({ label: "dns-lookup", value: 1 });
  });

  it("defaults to recognized human traffic and supports all and bot modes", async () => {
    const { getDashboardData } = await import("../lib/data");
    const human = await getDashboardData(siteId, "24h");
    const all = await getDashboardData(siteId, "24h", "all");
    const bots = await getDashboardData(siteId, "24h", "bot");
    expect(human.overview.pageViews).toBe(1);
    expect(all.overview.pageViews).toBe(2);
    expect(bots.overview.pageViews).toBe(1);
    expect(human.overview.averageSessionDuration).toBe(30_000);
    expect(all.overview.averageSessionDuration).toBe(20_000);
  });

  it("paginates and filters security and database-union log rows", async () => {
    const { getSecurityPage, getAppLogPage } = await import("../lib/list-data");
    const start = new Date(Date.now() - 86_400_000); const end = new Date(Date.now() + 60_000);
    const security = await getSecurityPage({ start, end, page: 1, pageSize: 25, traffic: "bot", q: "Test bot" });
    expect(security.total).toBe(1);
    expect(security.repeatVisitors[0]?.value).toBe(1);
    const logs = await getAppLogPage({ start, end, page: 1, pageSize: 25, traffic: "all", kind: "tracking", siteId });
    expect(logs.total).toBe(3);
    expect(logs.rows.every((row) => row.kind === "tracking")).toBe(true);
  });
});
