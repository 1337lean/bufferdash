import { ServerChart } from "@/components/Charts";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { getServerMetrics } from "@/lib/server-metrics";
import { bytes } from "@/lib/format";

export default async function ServerPage() {
  const { latest, history } = await getServerMetrics();
  const memoryPercent = latest?.memoryTotalMb ? Math.round(((latest.memoryUsedMb || 0) / latest.memoryTotalMb) * 100) : 0;
  const diskPercent = latest?.diskTotalGb ? Math.round(((latest.diskUsedGb || 0) / latest.diskTotalGb) * 100) : 0;

  return (
    <>
      <PageHeader eyebrow="Runtime" title="Application runtime health" description="Opt-in metrics visible to the BufferDash process. In Docker, some values may describe the container rather than the full VPS." />
      <section className="metrics-grid">
        <MetricCard label="CPU" value={`${Math.round(latest?.cpuPercent || 0)}%`} detail="Current load" tone="orange" />
        <MetricCard label="Memory" value={`${memoryPercent}%`} detail={`${Math.round(latest?.memoryUsedMb || 0)} MB used`} />
        <MetricCard label="Disk" value={`${diskPercent}%`} detail={`${Math.round(latest?.diskUsedGb || 0)} GB used`} tone="green" />
        <MetricCard label="Load avg" value={(latest?.load1 || 0).toFixed(2)} detail={`${Math.round((latest?.uptimeSeconds || 0) / 3600)}h uptime`} />
        <MetricCard label="Network RX" value={bytes(latest?.networkRxBytes)} detail="Runtime interface counter" />
        <MetricCard label="Network TX" value={bytes(latest?.networkTxBytes)} detail="Runtime interface counter" />
      </section>
      <section className="panel span-full">
        <div className="panel-header"><h2>Resource history</h2><span>Sampled every minute by the background worker</span></div>
        <ServerChart data={history} />
      </section>
    </>
  );
}
