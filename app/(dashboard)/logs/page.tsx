import { PageHeader } from "@/components/PageHeader";
import { getAppLogs } from "@/lib/data";
import { shortDate } from "@/lib/format";

export default async function LogsPage() {
  const logs = await getAppLogs();
  return (
    <>
      <PageHeader eyebrow="Event stream" title="Recent application activity" description="A private, database-backed stream of tracker events and security signals." />
      <section className="panel span-full">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Time</th><th>Source</th><th>Type</th><th>Message</th></tr></thead>
            <tbody>
              {logs.map((log) => <tr key={`${log.type}:${log.id}`}><td>{shortDate(log.createdAt)}</td><td>{log.source}</td><td>{log.type}</td><td>{log.message}</td></tr>)}
              {logs.length === 0 && <tr><td colSpan={4}>No events have been recorded.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
