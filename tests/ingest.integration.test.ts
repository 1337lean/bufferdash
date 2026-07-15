import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
vi.stubEnv("ENABLE_HTTP_INGESTION", "true");
vi.stubEnv("ENABLE_HOST_INGESTION", "true");
vi.stubEnv("INGESTION_SECRET", "integration-ingestion-secret-1234567890");
vi.stubEnv("ANONYMIZE_IP", "false");

const describeWithDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const secret = "integration-ingestion-secret-1234567890";

function request(path: string, body: unknown, authorized = true) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: authorized ? { authorization: `Bearer ${secret}` } : {},
    body: JSON.stringify(body)
  });
}

describeWithDatabase("host ingestion APIs", () => {
  let prisma: typeof import("../lib/prisma").prisma;
  let httpPost: typeof import("../app/api/ingest/http/route").POST;
  let hostPost: typeof import("../app/api/ingest/host/route").POST;
  const suffix = Date.now().toString(36);
  const batchKey = `batch-${suffix}`;
  const sampleKey = `test-host:${suffix}`;

  beforeAll(async () => {
    prisma = (await import("../lib/prisma")).prisma;
    httpPost = (await import("../app/api/ingest/http/route")).POST;
    hostPost = (await import("../app/api/ingest/host/route")).POST;
  });

  afterAll(async () => {
    await prisma.httpErrorSample.deleteMany({ where: { requestKey: { startsWith: suffix } } });
    await prisma.httpRequestBucket.deleteMany({ where: { host: `test-${suffix}.example` } });
    await prisma.ingestBatch.deleteMany({ where: { batchKey } });
    await prisma.serverMetric.deleteMany({ where: { sampleKey } });
    await prisma.ingestionSource.deleteMany({ where: { name: { in: ["caddy", "host"] } } });
    await prisma.$disconnect();
  });

  it("returns 404 when the bearer secret is absent", async () => {
    const response = await httpPost(request("/api/ingest/http", {}, false));
    expect(response.status).toBe(404);
  });

  it("aggregates all requests, samples only errors, strips queries, and deduplicates batches", async () => {
    const timestamp = new Date().toISOString();
    const body = {
      source: "caddy", batchKey, hostname: "test-host", agentVersion: "test",
      records: [
        { requestKey: `${suffix}-ok`, timestamp, host: `test-${suffix}.example`, method: "GET", path: "/ok?secret=value", status: 200, durationMs: 5, responseBytes: 10, clientIp: "203.0.113.10", userAgent: "test" },
        { requestKey: `${suffix}-error`, timestamp, host: `test-${suffix}.example`, method: "GET", path: "/fail?secret=value", status: 502, durationMs: 12, responseBytes: 20, clientIp: "203.0.113.10", userAgent: "Googlebot", error: "upstream?token=secret" }
      ]
    };
    expect((await httpPost(request("/api/ingest/http", body))).status).toBe(204);
    expect((await httpPost(request("/api/ingest/http", body))).status).toBe(204);
    const buckets = await prisma.httpRequestBucket.findMany({ where: { host: `test-${suffix}.example` }, orderBy: { status: "asc" } });
    expect(buckets).toHaveLength(2);
    expect(buckets.map((row) => row.requestCount)).toEqual([1, 1]);
    expect(buckets.map((row) => row.path)).toEqual(["/ok", "/fail"]);
    const samples = await prisma.httpErrorSample.findMany({ where: { requestKey: { startsWith: suffix } } });
    expect(samples).toHaveLength(1);
    expect(samples[0]).toMatchObject({ path: "/fail", status: 502, isBot: true, ipAddress: "203.0.113.0", proxyError: "upstream?[redacted]" });
  });

  it("stores an idempotent host-scoped metric", async () => {
    const timestamp = new Date().toISOString();
    const body = { sampleKey, timestamp, hostname: "test-host", agentVersion: "test", cpuPercent: 12.4, memoryUsedMb: 1024, memoryTotalMb: 4096, diskUsedGb: 24.2, diskTotalGb: 80, load1: 0.3, load5: 0.2, load15: 0.2, uptimeSeconds: 123456, networkRxBytes: 123, networkTxBytes: 456 };
    expect((await hostPost(request("/api/ingest/host", body))).status).toBe(204);
    expect((await hostPost(request("/api/ingest/host", body))).status).toBe(204);
    expect(await prisma.serverMetric.count({ where: { sampleKey, scope: "host" } })).toBe(1);
  });
});
