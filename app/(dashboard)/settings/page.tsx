import { deleteOldDataAction } from "@/app/actions";
import { PageHeader } from "@/components/PageHeader";
import { ActionForm } from "@/components/StateMessage";
import { getCsrfToken } from "@/lib/auth";
import { env } from "@/lib/env";

export default async function SettingsPage() {
  const csrf = await getCsrfToken();

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
            <p><span>Runtime metrics</span><strong>{env.enableServerMetrics ? "On" : "Off"}</strong></p>
            <p><span>GeoIP</span><strong>{env.ipinfoToken ? `IPinfo ${env.ipinfoTier}` : "Proxy headers only"}</strong></p>
            <p><span>Host log ingestion</span><strong>{env.enableLogIngestion ? "On" : "Off"}</strong></p>
          </div>
        </section>
        <section className="panel">
          <div className="panel-header"><h2>Configuration</h2></div>
          <p className="muted">Edit `.env` and restart BufferDash to change privacy, proxy, retention, and runtime settings. Secrets are intentionally never editable in the browser.</p>
        </section>
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
