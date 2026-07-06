import "server-only";

import os from "os";
import si from "systeminformation";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export async function collectServerMetric() {
  if (!env.enableServerMetrics) {
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

export async function getServerMetrics() {
  const latest = await collectServerMetric();
  const history = await prisma.serverMetric.findMany({
    orderBy: { createdAt: "desc" },
    take: 48
  });

  return {
    latest,
    history: history.reverse().map((metric) => ({
      time: metric.createdAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      cpu: Math.round(metric.cpuPercent || 0),
      memory: metric.memoryTotalMb ? Math.round(((metric.memoryUsedMb || 0) / metric.memoryTotalMb) * 100) : 0,
      disk: metric.diskTotalGb ? Math.round(((metric.diskUsedGb || 0) / metric.diskTotalGb) * 100) : 0,
      load: Number((metric.load1 || 0).toFixed(2))
    }))
  };
}
