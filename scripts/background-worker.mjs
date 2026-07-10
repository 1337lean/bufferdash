import os from "node:os";
import { writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import si from "systeminformation";

const prisma = new PrismaClient();
const metricsEnabled = process.env.ENABLE_SERVER_METRICS === "true";
const retentionDays = boundedNumber(process.env.DATA_RETENTION_DAYS, 90, 1, 3650);
const metricsSeconds = boundedNumber(process.env.METRICS_INTERVAL_SECONDS, 60, 15, 3600);
const cleanupHours = boundedNumber(process.env.CLEANUP_INTERVAL_HOURS, 24, 1, 168);

function boundedNumber(value, fallback, min, max) {
  const number = Number(value || fallback);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

async function collectMetric() {
  if (!metricsEnabled) return;
  try {
    const [load, mem, disks, networks] = await Promise.all([si.currentLoad(), si.mem(), si.fsSize(), si.networkStats()]);
    const disk = disks.find((item) => item.mount === "/") || disks[0];
    const network = networks.reduce((total, item) => ({ rx: total.rx + item.rx_bytes, tx: total.tx + item.tx_bytes }), { rx: 0, tx: 0 });
    await prisma.serverMetric.create({ data: {
      cpuPercent: load.currentLoad,
      memoryUsedMb: (mem.total - mem.available) / 1024 / 1024, memoryTotalMb: mem.total / 1024 / 1024,
      diskUsedGb: disk ? disk.used / 1024 / 1024 / 1024 : null, diskTotalGb: disk ? disk.size / 1024 / 1024 / 1024 : null,
      load1: os.loadavg()[0], load5: os.loadavg()[1], load15: os.loadavg()[2], uptimeSeconds: Math.round(os.uptime()),
      networkRxBytes: BigInt(Math.max(0, Math.round(network.rx))), networkTxBytes: BigInt(Math.max(0, Math.round(network.tx)))
    } });
  } catch (error) {
    console.error("metric collection failed", error instanceof Error ? error.message : error);
  }
}

async function cleanup() {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.event.deleteMany({ where: { createdAt: { lt: cutoff } } });
      await tx.securityEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
      await tx.serverMetric.deleteMany({ where: { createdAt: { lt: cutoff } } });
      await tx.session.deleteMany({ where: { endedAt: { lt: cutoff } } });
      await tx.visitor.deleteMany({ where: { events: { none: {} }, sessions: { none: {} } } });
    });
  } catch (error) {
    console.error("retention cleanup failed", error instanceof Error ? error.message : error);
  }
}

async function heartbeat() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await writeFile("/tmp/bufferdash-worker-heartbeat", String(Date.now()), "utf8");
  } catch (error) {
    console.error("worker heartbeat failed", error instanceof Error ? error.message : error);
  }
}

await prisma.$connect();
await cleanup();
await collectMetric();
await heartbeat();
const metricTimer = metricsEnabled ? setInterval(collectMetric, metricsSeconds * 1000) : null;
const cleanupTimer = setInterval(cleanup, cleanupHours * 60 * 60 * 1000);
const heartbeatTimer = setInterval(heartbeat, 30 * 1000);

async function shutdown() {
  if (metricTimer) clearInterval(metricTimer);
  clearInterval(cleanupTimer);
  clearInterval(heartbeatTimer);
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
