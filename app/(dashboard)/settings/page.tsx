import { deleteOldDataAction } from "@/app/actions";
import { PageHeader } from "@/components/PageHeader";
import { ActionForm } from "@/components/StateMessage";
import { getCsrfToken } from "@/lib/auth";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { shortDate } from "@/lib/format";
import { InfoCallout } from "@/components/InfoCallout";

export default async function SettingsPage() {
  const [csrf, sources, databaseTime] = await Promise.all([
    getCsrfToken(),
    prisma.ingestionSource.findMany({ orderBy: { name: "asc" } }),
    prisma.$queryRaw<Array<{ now: Date }>>`SELECT CURRENT_TIMESTAMP AS now`
  ]);
  const checkedAt = databaseTime[0]?.now.getTime() || 0;

  return (
    <>
      <PageHeader eyebrow="Settings" title="Privacy and operations" description="Runtime settings are intentionally environment-driven for v1." />
      <section className="dashboard-grid">
        <section className="panel">
          <div className="panel-header"><h2>Current runtime</h2></div>
          <div className="settings-list">
            <p><span>IP anonymization</span><strong>{env.anonymizeIp ? "On" : "Off"}</strong></p>
            <p><span>Trust proxy headers</span><strong>{env.trustProxy ? "On" : "Off"}</strong></p>
            <p><span>Site origin checks</span><strong>{env.enforceTrackingOrigin ? "On" : "Off"}</strong></p>
            <p><span>Bot filtering</span><strong>{env.filterBots ? "On" : "Off"}</strong></p>
            <p><span>Retention default</span><strong>{env.dataRetentionDays} days</strong></p>
            <p><span>Runtime metrics</span><strong>{env.serverMetricsSource}</strong></p>
            <p><span>GeoIP</span><strong>{env.ipinfoToken ? `IPinfo ${env.ipinfoTier}` : "Proxy headers only"}</strong></p>
            <p><span>HTTP ingestion</span><strong>{env.enableHttpIngestion ? "On" : "Off"}</strong></p>
            <p><span>Host ingestion</span><strong>{env.enableHostIngestion ? "On" : "Off"}</strong></p>
          </div>
        </section>
        <section className="panel">
          <div className="panel-header"><h2>Configuration</h2></div>
          <p className="muted">Edit `.env` and restart BufferDash to change privacy, proxy, retention, and runtime settings. Secrets are intentionally never editable in the browser.</p>
        </section>
      </section>
      <section className="panel span-full"><div className="panel-header"><h2>Collector freshness</h2><span>Stale after 150 seconds</span></div>
        {sources.length ? <div className="settings-list">{sources.map((source) => { const stale = checkedAt - source.lastSeenAt.getTime() > 150_000; return <p key={source.id}><span>{source.name} · {source.hostname || "unknown host"} · agent {source.agentVersion || "unknown"}</span><strong>{stale ? "Stale" : "Fresh"} · {shortDate(source.lastSeenAt)}</strong></p>; })}</div> : <InfoCallout title="No collectors seen" tone="warning">Install and start the host agent after enabling ingestion.</InfoCallout>}
      </section>
      <section className="panel span-full">
        <div className="panel-header"><h2>Data retention cleanup</h2></div>
        <ActionForm action={deleteOldDataAction} className="form-grid">
          <input type="hidden" name="csrf" value={csrf} />
          <label>
            <span>Delete data older than</span>
            <input name="days" type="number" min={1} max={3650} defaultValue={env.dataRetentionDays} />
          </label>
          <button className="danger-button" type="submit">Delete old rows</button>
        </ActionForm>
      </section>
    </>
  );
}
