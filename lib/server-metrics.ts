import "server-only";

import os from "os";
import si from "systeminformation";
import type { ServerMetric } from "@prisma/client";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export async function collectServerMetric() {
  if (env.serverMetricsSource !== "container") {
    return null;
  }

  try {
    const [load, mem, fsSize, networkStats] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.networkStats()
    ]);

    const disk = fsSize[0];
    const network = networkStats[0];

    return prisma.serverMetric.create({
      data: {
        scope: "container",
        hostname: os.hostname(),
        cpuPercent: load.currentLoad,
        memoryUsedMb: (mem.total - mem.available) / 1024 / 1024,
        memoryTotalMb: mem.total / 1024 / 1024,
        diskUsedGb: disk ? disk.used / 1024 / 1024 / 1024 : null,
        diskTotalGb: disk ? disk.size / 1024 / 1024 / 1024 : null,
        load1: os.loadavg()[0],
        load5: os.loadavg()[1],
        load15: os.loadavg()[2],
        uptimeSeconds: Math.round(os.uptime()),
        networkRxBytes: network ? BigInt(network.rx_bytes) : null,
        networkTxBytes: network ? BigInt(network.tx_bytes) : null
      }
    });
  } catch {
    return prisma.serverMetric.create({
      data: {
        scope: "container",
        hostname: os.hostname(),
        load1: os.loadavg()[0],
        load5: os.loadavg()[1],
        load15: os.loadavg()[2],
        uptimeSeconds: Math.round(os.uptime()),
        memoryUsedMb: (os.totalmem() - os.freemem()) / 1024 / 1024,
        memoryTotalMb: os.totalmem() / 1024 / 1024
      }
    });
  }
}

export type RuntimeRange = "1h" | "6h" | "24h" | "7d";

export async function getServerMetrics(range: RuntimeRange = "6h") {
  const rangeMs = range === "1h" ? 3_600_000 : range === "6h" ? 21_600_000 : range === "24h" ? 86_400_000 : 7 * 86_400_000;
  const hostLatest = await prisma.serverMetric.findFirst({ where: { scope: "host" }, orderBy: { createdAt: "desc" } });
  const hostFresh = Boolean(hostLatest && Date.now() - hostLatest.createdAt.getTime() <= 150_000);
  const scope = hostFresh || env.serverMetricsSource === "host" ? "host" : "container";
  let latest: ServerMetric | null = scope === "host" ? hostLatest : await prisma.serverMetric.findFirst({ where: { scope: "container" }, orderBy: { createdAt: "desc" } });
  if (scope === "container" && env.serverMetricsSource === "container" && (!latest || Date.now() - latest.createdAt.getTime() > 120_000)) {
    latest = await collectServerMetric();
  }
  let history = await prisma.serverMetric.findMany({
    where: { scope, createdAt: { gte: new Date(Date.now() - rangeMs) } },
    orderBy: { createdAt: "asc" }
  });
  if (history.length > 240) {
    const stride = Math.ceil(history.length / 240);
    history = history.filter((_, index) => index % stride === 0 || index === history.length - 1);
  }
  const last = history.at(-1);
  const previous = history.at(-2);
  const elapsed = last && previous ? Math.max(1, (last.createdAt.getTime() - previous.createdAt.getTime()) / 1000) : 0;
  const rxRate = elapsed && last?.networkRxBytes != null && previous?.networkRxBytes != null ? Math.max(0, Number(last.networkRxBytes - previous.networkRxBytes) / elapsed) : 0;
  const txRate = elapsed && last?.networkTxBytes != null && previous?.networkTxBytes != null ? Math.max(0, Number(last.networkTxBytes - previous.networkTxBytes) / elapsed) : 0;

  return {
    latest,
    scope,
    stale: !latest || Date.now() - latest.createdAt.getTime() > 150_000,
    rxRate,
    txRate,
    history: history.map((metric) => ({
      time: metric.createdAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      cpu: Math.round(metric.cpuPercent || 0),
      memory: metric.memoryTotalMb ? Math.round(((metric.memoryUsedMb || 0) / metric.memoryTotalMb) * 100) : 0,
      disk: metric.diskTotalGb ? Math.round(((metric.diskUsedGb || 0) / metric.diskTotalGb) * 100) : 0,
      load: Number((metric.load1 || 0).toFixed(2))
    }))
  };
}
