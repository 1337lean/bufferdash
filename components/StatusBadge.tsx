export function StatusBadge({ isBot, botName, asn, isp }: { isBot: boolean | null; botName?: string | null; asn?: string | null; isp?: string | null }) {
  if (isBot) return <span className="status-badge bot">Bot · {botName || "Generic bot"}</span>;
  const cloudflare = asn?.toUpperCase() === "AS13335" || isp?.toLowerCase().includes("cloudflare");
  if (cloudflare) return <span className="status-badge network">Network · Cloudflare</span>;
  if (isp || asn) return <span className="status-badge network">Network · {isp || asn}</span>;
  return <span className="status-badge human">Human/unknown</span>;
}
