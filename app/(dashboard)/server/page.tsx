import Link from "next/link";
import { ServerChart } from "@/components/Charts";
import { InfoCallout } from "@/components/InfoCallout";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { getServerMetrics, type RuntimeRange } from "@/lib/server-metrics";
import { bytes, shortDate } from "@/lib/format";

export default async function ServerPage({ searchParams }: { searchParams: Promise<{ range?: string | string[] }> }) {
  const raw = (await searchParams).range;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const range: RuntimeRange = ["1h", "6h", "24h", "7d"].includes(value || "") ? value as RuntimeRange : "6h";
  const { latest, history, scope, stale, rxRate, txRate } = await getServerMetrics(range);
  const memoryPercent = latest?.memoryTotalMb ? Math.round(((latest.memoryUsedMb || 0) / latest.memoryTotalMb) * 100) : 0;
  const diskPercent = latest?.diskTotalGb ? Math.round(((latest.diskUsedGb || 0) / latest.diskTotalGb) * 100) : 0;
  const sourceLabel = stale ? "stale" : scope === "host" ? "VPS host" : "Docker container";
  return <>
    <PageHeader eyebrow="Runtime" title="Server health" description="Explicitly scoped resource metrics; container disk is never presented as VPS disk." />
    <nav className="range-selector">{(["1h", "6h", "24h", "7d"] as const).map((item) => <Link className={range === item ? "active" : undefined} href={`/server?range=${item}`} key={item}>{item}</Link>)}</nav>
    <InfoCallout title={`Source · ${sourceLabel}`} tone={stale ? "warning" : "info"}>{latest ? <>{latest.hostname || "Unknown hostname"} · last sample {shortDate(latest.createdAt)}.</> : "No runtime samples have been received."} {scope === "container" && "Values describe the Docker container-visible environment."}</InfoCallout>
    <section className="metrics-grid">
      <MetricCard label="CPU" value={`${Math.round(latest?.cpuPercent || 0)}%`} detail={sourceLabel} tone="orange" />
      <MetricCard label="Memory" value={`${memoryPercent}%`} detail={`${Math.round(latest?.memoryUsedMb || 0)} / ${Math.round(latest?.memoryTotalMb || 0)} MB`} />
      <MetricCard label="Disk" value={`${diskPercent}%`} detail={`${(latest?.diskUsedGb || 0).toFixed(1)} / ${(latest?.diskTotalGb || 0).toFixed(1)} GB`} tone="green" />
      <MetricCard label="Load avg" value={(latest?.load1 || 0).toFixed(2)} detail={`${Math.round((latest?.uptimeSeconds || 0) / 3600)}h uptime`} />
      <MetricCard label="Network RX rate" value={`${bytes(rxRate)}/s`} detail={`${bytes(latest?.networkRxBytes)} total`} />
      <MetricCard label="Network TX rate" value={`${bytes(txRate)}/s`} detail={`${bytes(latest?.networkTxBytes)} total`} />
    </section>
    <section className="panel span-full"><div className="panel-header"><h2>Resource history</h2><span>{range} · downsampled to 240 points</span></div><ServerChart data={history} /></section>
  </>;
}
